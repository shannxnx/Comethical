import { HttpError } from './http.ts';
import { parseModelJson } from './core/scenario-validation.ts';

/**
 * Minimal Gemini REST client with timeout, bounded retries and JSON-mode output.
 * The API key stays in Edge Function secrets; no player data is ever sent.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-latest';
const TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

export function geminiModel(): string {
  return Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;
}

export interface GeminiRequest {
  system: string;
  prompt: string;
  /** OpenAPI-style schema (Gemini `responseSchema`). */
  schema: Record<string, unknown>;
  temperature?: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generateJson(request: GeminiRequest): Promise<unknown> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new HttpError(503, 'ai_unavailable', 'GEMINI_API_KEY is not configured.');

  const body = {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
    generationConfig: {
      temperature: request.temperature ?? 0.8,
      responseMimeType: 'application/json',
      responseSchema: request.schema,
    },
  };

  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(geminiModel())}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = `Gemini HTTP ${res.status}`;
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      if (!res.ok) {
        // 4xx other than 429 will not succeed on retry.
        throw new HttpError(502, 'ai_error', `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const payload = await res.json();
      const text: unknown = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') {
        lastError = `No content (finishReason: ${payload?.candidates?.[0]?.finishReason ?? 'n/a'})`;
        continue;
      }
      const parsed = parseModelJson(text);
      if (parsed === null) {
        lastError = 'Model returned invalid JSON';
        continue;
      }
      return parsed;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      lastError = error instanceof Error && error.name === 'AbortError' ? 'Gemini request timed out' : String(error);
      await sleep(500 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HttpError(502, 'ai_error', `Gemini failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}
