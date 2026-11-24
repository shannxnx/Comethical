import { getSupabase } from '@/lib/supabase';
import { parseFunctionError } from '@/services/online-repository';
import { AppError } from '@/types/game';
import type { AdminFilter, AdminScenario, AdminStats, GenerateRequest, GenerateResult, ScenarioPatch } from './types';

/** Gemini generation can take a while (generation + an independent review per scenario). */
const TIMEOUT_MS = 120_000;

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new AppError('offline_mode', 'Admin tools need the Supabase backend.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError('timeout', 'The server took too long. Please try again.', true)), TIMEOUT_MS);
  });
  try {
    const { data, error } = await Promise.race([supabase.functions.invoke<T>('admin-scenarios', { body: { action, ...body } }), timeout]);
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

export const adminApi = {
  list: (status: AdminFilter) =>
    call<{ scenarios: AdminScenario[]; stats: AdminStats }>('list', { status: status === 'all' ? undefined : status, limit: 100 }),
  generate: (req: GenerateRequest) => call<GenerateResult>('generate', { ...req }),
  update: (id: string, patch: ScenarioPatch, approve = false) =>
    call<{ scenario: AdminScenario | null }>('update', { id, patch, approve }),
  reassess: (id: string) => call<{ scenario: AdminScenario | null }>('reassess', { id }),
  setStatus: (ids: string[], status: 'approved' | 'rejected' | 'pending') =>
    call<{ scenarios: AdminScenario[] }>('set-status', { ids, status }),
  remove: (id: string) => call<{ deleted: boolean }>('delete', { id }),
  exportApproved: () => call<{ scenarios: unknown[] }>('export'),
};
