import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { catalogCostFetch } from '@/lib/catalogCostAccess';
import { privateMediaFetch } from '@/lib/privateMedia';

// Single production backend for the entire Hitech app.
// Keep this explicit so hosting-provider environment overrides cannot silently
// point authentication, catalog, quotations, or other modules at an old project.
const SUPABASE_URL = 'https://ejxautrxbcemrncpzjyg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NDjWvTxfOE7KIuzEqjRZLA_YUrWpSPB';

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
