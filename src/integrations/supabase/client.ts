import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { catalogCostFetch } from '@/lib/catalogCostAccess';
import { privateMediaFetch } from '@/lib/privateMedia';

// Explicit build-time selection: normal production uses the known primary.
// Hostinger recovery builds MUST set BOTH VITE_SUPABASE_URL and
// VITE_SUPABASE_PUBLISHABLE_KEY. Never put service_role keys in a Vite env var.
// A build targeting recovery must be tested before deployment; this is not
// automatic runtime failover and does not change the live production bundle.
const recoveryUrl = import.meta.env.VITE_SUPABASE_URL;
const recoveryKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (Boolean(recoveryUrl) !== Boolean(recoveryKey)) {
  throw new Error('Set both recovery Supabase configuration values together');
}
const SUPABASE_URL = recoveryUrl || 'https://ejxautrxbcemrncpzjyg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = recoveryKey || 'sb_publishable_NDjWvTxfOE7KIuzEqjRZLA_YUrWpSPB';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: privateMediaFetch(catalogCostFetch((input, init) => fetch(input, init))) },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function uploadedMediaUrl(bucket: string, path: string) {
  if (bucket !== 'quotations') return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error('Could not open uploaded attachment');
  return data.signedUrl;
}
