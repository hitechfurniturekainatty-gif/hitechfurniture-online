#!/usr/bin/env node
/**
 * Migrate auth.users from OLD Supabase project -> NEW Supabase project.
 *
 * Preserves user `id` so existing FKs keep working:
 *   profiles.user_id, user_roles.user_id, workers.user_id, etc.
 *
 * Also preserves: email, phone, email_confirmed_at, phone_confirmed_at,
 * raw_user_meta_data, raw_app_meta_data, created_at, and the encrypted
 * password hash (so users can keep signing in with the SAME password / PIN).
 *
 * Requirements:
 *   - Node 18+ (uses built-in fetch)
 *   - Service-role keys for BOTH projects (NEVER expose these in the browser)
 *
 * Usage:
 *   OLD_SUPABASE_URL=https://<old-ref>.supabase.co \
 *   OLD_SERVICE_ROLE_KEY=<old service role key> \
 *   NEW_SUPABASE_URL=https://ejxautrxbcemrncpzjyg.supabase.co \
 *   NEW_SERVICE_ROLE_KEY=<new service role key> \
 *   node migration/auth/migrate-auth-users.mjs
 *
 * Notes:
 *   - We use the Admin REST endpoint /auth/v1/admin/users which supports
 *     `password_hash` on create, so existing bcrypt/scrypt hashes are kept.
 *   - Users that already exist in the new project (matched by id) are skipped.
 *   - On any row that fails, the script logs the error and continues.
 */

const {
  OLD_SUPABASE_URL,
  OLD_SERVICE_ROLE_KEY,
  NEW_SUPABASE_URL,
  NEW_SERVICE_ROLE_KEY,
} = process.env;

for (const [k, v] of Object.entries({
  OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY, NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY,
})) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1); }
}

const PAGE = 1000;

async function listAllUsers(baseUrl, key) {
  const all = [];
  let page = 1;
  while (true) {
    const url = `${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${PAGE}`;
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`List users failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const users = json.users ?? [];
    all.push(...users);
    if (users.length < PAGE) break;
    page++;
  }
  return all;
}

async function getExistingIds(baseUrl, key) {
  const ids = new Set();
  const users = await listAllUsers(baseUrl, key);
  for (const u of users) ids.add(u.id);
  return ids;
}

async function createUser(baseUrl, key, src) {
  const body = {
    id: src.id,
    email: src.email ?? undefined,
    phone: src.phone ?? undefined,
    email_confirm: !!src.email_confirmed_at,
    phone_confirm: !!src.phone_confirmed_at,
    user_metadata: src.user_metadata ?? src.raw_user_meta_data ?? {},
    app_metadata: src.app_metadata ?? src.raw_app_meta_data ?? {},
    // Preserves existing password — users can keep signing in with the same password/PIN.
    password_hash: src.encrypted_password || undefined,
  };
  const res = await fetch(`${baseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt}`);
  }
  return res.json();
}

(async () => {
  console.log('→ Listing users in OLD project…');
  const srcUsers = await listAllUsers(OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY);
  console.log(`  found ${srcUsers.length}`);

  console.log('→ Listing users already in NEW project…');
  const existing = await getExistingIds(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY);
  console.log(`  found ${existing.size} already there`);

  let ok = 0, skipped = 0, failed = 0;
  for (const u of srcUsers) {
    if (existing.has(u.id)) { skipped++; continue; }
    try {
      await createUser(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, u);
      ok++;
      process.stdout.write('.');
    } catch (e) {
      failed++;
      console.error(`\n✗ ${u.email || u.phone || u.id}: ${e.message}`);
    }
  }
  console.log(`\nDone. created=${ok}, skipped=${skipped}, failed=${failed}`);
})().catch((e) => { console.error(e); process.exit(1); });