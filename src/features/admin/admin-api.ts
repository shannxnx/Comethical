import { getSupabase } from '@/lib/supabase';
import { parseFunctionError } from '@/services/online-repository';
import { AppError } from '@/types/game';
import type { AdminScenario, AdminStats, GenerateRequest, GenerateResult, ListQuery, ScenarioPatch } from './types';

/** Gemini generation can take a while (generation + an independent review per scenario). */
const TIMEOUT_MS = 120_000;

/** Calls an Edge Function action with a timeout and friendly errors. */
export async function invokeFunction<T>(fn: string, action: string, body: Record<string, unknown> = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new AppError('offline_mode', 'Admin tools need the Supabase backend.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError('timeout', 'The server took too long. Please try again.', true)), timeoutMs);
  });
  try {
    const { data, error } = await Promise.race([supabase.functions.invoke<T>(fn, { body: { action, ...body } }), timeout]);
    if (error) throw await parseFunctionError(error);
    if (data == null) throw new AppError('empty_response', 'The server sent an empty response.', true);
    return data;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('network', 'Could not reach the server. Check your internet connection.', true);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const call = <T>(action: string, body: Record<string, unknown> = {}) => invokeFunction<T>('admin-scenarios', action, body);

export interface ListResult {
  scenarios: AdminScenario[];
  matching: number;
  stats: AdminStats;
}

export const adminApi = {
  list: (query: ListQuery) => call<ListResult>('list', { limit: 50, ...query }),
  generate: (req: GenerateRequest) => call<GenerateResult>('generate', { ...req }),
  update: (id: string, patch: ScenarioPatch, approve = false) =>
    call<{ scenario: AdminScenario | null }>('update', { id, patch, approve }),
  reassess: (id: string) => call<{ scenario: AdminScenario | null }>('reassess', { id }),
  setStatus: (ids: string[], status: 'approved' | 'rejected' | 'pending') =>
    call<{ scenarios: AdminScenario[] }>('set-status', { ids, status }),
  setInGame: (ids: string[], inGame: boolean) => call<{ scenarios: AdminScenario[] }>('set-in-game', { ids, inGame }),
  remove: (id: string) => call<{ deleted: boolean }>('delete', { id }),
  exportApproved: () => call<{ scenarios: unknown[] }>('export'),
};
