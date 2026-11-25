import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { create } from 'zustand';

import { getSupabase } from '@/lib/supabase';

export type AuthStatus = 'initializing' | 'demo' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<{ needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is incorrect.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists.';
  if (m.includes('email not confirmed')) return 'Please confirm your email address first, then sign in.';
  if (m.includes('password should be')) return 'Password must be at least 8 characters.';
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'Could not reach the server. Check your connection.';
  return message;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'initializing',
  session: null,

  initialize: () => {
    const supabase = getSupabase();
    if (!supabase) {
      set({ status: 'demo', session: null });
      return () => {};
    }
    supabase.auth
      .getSession()
      .then(({ data }) => set({ session: data.session, status: data.session ? 'signedIn' : 'signedOut' }))
      .catch(() => set({ session: null, status: 'signedOut' }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, status: session ? 'signedIn' : 'signedOut' });
    });
    return () => data.subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(friendlyAuthError(error.message));
  },

  signUp: async (email, password, username) => {
    const supabase = getSupabase();
    if (!supabase) return { needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Every new account is a player. Admin access comes only from an admin invite.
      options: { data: { username: username.trim() } },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    return { needsConfirmation: !data.session };
  },

  resetPassword: async (email) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null, status: 'signedOut' });
  },
}));
