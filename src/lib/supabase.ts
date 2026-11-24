import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { ENV } from './env';
import type { Database } from '@/types/database';

let client: SupabaseClient<Database> | null = null;

/** Returns the Supabase client, or null in local demo mode. */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!ENV.backendConfigured) return null;
  if (!client) {
    client = createClient<Database>(ENV.supabaseUrl, ENV.supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // Refresh tokens only while the app is in the foreground.
    if (Platform.OS !== 'web') {
      AppState.addEventListener('change', (state) => {
        if (state === 'active') client?.auth.startAutoRefresh();
        else client?.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}

export function requireSupabase(): SupabaseClient<Database> {
  const c = getSupabase();
  if (!c) throw new Error('Supabase is not configured.');
  return c;
}
