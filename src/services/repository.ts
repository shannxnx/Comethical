import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase } from '@/lib/supabase';
import type { GameRepository } from '@/types/game';
import { DemoRepository } from './demo-repository';
import { OnlineRepository } from './online-repository';

let instance: GameRepository | null = null;

/**
 * Online when Supabase is configured; otherwise the clearly-labelled local demo.
 * We never silently fall back to demo data when a backend is configured.
 */
export function getRepository(): GameRepository {
  if (!instance) {
    const supabase = getSupabase();
    instance = supabase ? new OnlineRepository(supabase) : new DemoRepository(AsyncStorage);
  }
  return instance;
}

export function isDemoMode(): boolean {
  return getRepository().kind === 'demo';
}
