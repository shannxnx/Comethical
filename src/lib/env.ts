/**
 * Public, client-safe configuration. EXPO_PUBLIC_* variables are inlined at build time.
 * The Gemini key and Supabase service-role key are NEVER read here — they live in
 * Supabase Edge Function secrets.
 */
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

function looksConfigured(url: string, key: string): boolean {
  return /^https?:\/\//.test(url) && key.length > 20 && !url.includes('your-project');
}

export const ENV = {
  supabaseUrl,
  supabaseKey,
  /** When false the app runs in local demo mode with on-device data. */
  backendConfigured: looksConfigured(supabaseUrl, supabaseKey),
} as const;
