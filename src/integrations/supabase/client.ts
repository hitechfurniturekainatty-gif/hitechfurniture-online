import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Single production backend for the entire Hitech app.
// Keep this explicit so hosting-provider environment overrides cannot silently
// point authentication, catalog, quotations, or other modules at an old project.
const SUPABASE_URL = 'https://ejxautrxbcemrncpzjyg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NDjWvTxfOE7KIuzEqjRZLA_YUrWpSPB';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
