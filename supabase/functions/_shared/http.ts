export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const MAX_BODY_BYTES = 16_384;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST.');
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', 'Request body is too large.');
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be a JSON object.');
  }
}

/** Wraps a handler with CORS preflight + uniform error responses. */
export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: { code: error.code, message: error.message } }, error.status);
      }
      console.error('Unhandled error', error);
      return json({ error: { code: 'internal', message: 'Something went wrong. Please try again.' } }, 500);
    }
  });
}

export function requireString(body: Record<string, unknown>, key: string, maxLength = 200): string {
  const value = body[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new HttpError(400, 'invalid_request', `"${key}" is required.`);
  }
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(body: Record<string, unknown>, key: string): string {
  const value = requireString(body, key, 36);
  if (!UUID_RE.test(value)) throw new HttpError(400, 'invalid_request', `"${key}" must be a UUID.`);
  return value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
