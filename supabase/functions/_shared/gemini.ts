import { HttpError } from './http.ts';
import { parseModelJson } from './core/scenario-validation.ts';

/**
 * Minimal Gemini REST client with timeouts, bounded retries, model fallback and JSON-mode output.
 * The API key stays in Edge Function secrets; no player data is ever sent.
 *
 * When a model is overloaded (HTTP 503) or rate limited (429), the next model in the chain is
 * tried instead of hammering the same one. Override with secrets:
 *   GEMINI_MODEL=gemini-2.5-flash
 *   GEMINI_FALLBACK_MODELS=gemini-flash-lite-latest,gemini-2.5-flash-lite
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-latest';
const DEFAULT_FALLBACKS = ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
/** Per request. */
const TIMEOUT_MS = 35_000;
/** Whole call, so the Edge Function (and the app) never wait indefinitely. */
const TOTAL_BUDGET_MS = 100_000;
const MAX_ATTEMPTS = 5;

export function geminiModel(): string {
  return Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;
}

function modelChain(): string[] {
  const extra = (Deno.env.get('GEMINI_FALLBACK_MODELS') ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([geminiModel(), ...(extra.length ? extra : DEFAULT_FALLBACKS)])];
}

export interface GeminiRequest {
  system: string;
  prompt: string;
  /** OpenAPI-style schema (Gemini `responseSchema`). */
  schema: Record<string, unknown>;
  temperature?: number;
  /** Total time allowed for this call including retries (default 100 s). */
  budgetMs?: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generateJson(request: GeminiRequest): Promise<unknown> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new HttpError(503, 'ai_unavailable', 'GEMINI_API_KEY is not configured.');

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
    generationConfig: {
      temperature: request.temperature ?? 0.8,
      responseMimeType: 'application/json',
      responseSchema: request.schema,
    },
  });

  const models = modelChain();
  const started = Date.now();
  const errors: string[] = [];
  let modelIndex = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = (request.budgetMs ?? TOTAL_BUDGET_MS) - (Date.now() - started);
    if (remaining < 5_000) break;
    const model = models[modelIndex % models.length] as string;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(TIMEOUT_MS, remaining));
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        errors.push(`${model}: HTTP ${res.status}`);
        modelIndex++; // overloaded / rate-limited → try the next model
        await sleep(800);
        continue;
      }
      if (res.status === 404) {
        errors.push(`${model}: not available`);
        modelIndex++;
        continue;
      }
      if (!res.ok) {
        // 400/401/403 (bad key, bad request) will not succeed on retry.
        const detail = (await res.text()).slice(0, 300);
        throw new HttpError(
          502,
          res.status === 400 || res.status === 401 || res.status === 403 ? 'ai_auth' : 'ai_error',
          `Gemini rejected the request (HTTP ${res.status}). ${res.status === 403 || res.status === 400 ? 'Check that GEMINI_API_KEY is a valid Gemini API key. ' : ''}${detail}`,
        );
      }
      const payload = await res.json();
      const text: unknown = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') {
        errors.push(`${model}: no content (${payload?.candidates?.[0]?.finishReason ?? 'n/a'})`);
        continue;
      }
      const parsed = parseModelJson(text);
      if (parsed === null) {
        errors.push(`${model}: invalid JSON`);
        continue;
      }
      return parsed;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const timedOut = error instanceof Error && error.name === 'AbortError';
      errors.push(`${model}: ${timedOut ? 'timed out' : String(error)}`);
      if (timedOut) modelIndex++;
      await sleep(500);
    } finally {
      clearTimeout(timer);
    }
  }

  const overloaded = errors.some((e) => /HTTP (503|429)|timed out/.test(e));
  throw new HttpError(
    503,
    overloaded ? 'ai_busy' : 'ai_error',
    overloaded
      ? `Gemini is busy right now (${errors.slice(-3).join('; ')}). Please try again in a minute.`
      : `Gemini failed: ${errors.slice(-3).join('; ')}`,
  );
}
