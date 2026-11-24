import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, 'server_misconfigured', `Missing server secret ${name}.`);
  return value;
}

/** Service-role client. Bypasses RLS — only used inside Edge Functions, never shipped to the app. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolves the calling user from the Authorization header, or throws 401. */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<{ id: string }> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'session_expired', 'Your session has expired. Please sign in again.');
  return { id: data.user.id };
}

/** Admin endpoints (AI generation / assessment) require a shared secret header. */
export function requireAdmin(req: Request): void {
  const expected = Deno.env.get('ADMIN_API_KEY');
  if (!expected) throw new HttpError(500, 'server_misconfigured', 'ADMIN_API_KEY is not set.');
  const provided = req.headers.get('x-admin-key') ?? '';
  // Constant-time-ish comparison.
  let diff = provided.length ^ expected.length;
  for (let i = 0; i < Math.max(provided.length, expected.length); i++) {
    diff |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  if (diff !== 0) throw new HttpError(403, 'forbidden', 'Admin key required.');
}
