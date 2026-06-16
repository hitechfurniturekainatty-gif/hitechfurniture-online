# Auth users migration (old Supabase → new Supabase)

Copies every row from `auth.users` in the **old** project into the **new**
project, preserving:

- `id` (so `profiles.user_id`, `user_roles.user_id`, `workers.user_id`, etc. still match)
- email / phone + their confirmation timestamps
- `user_metadata` / `app_metadata`
- the **encrypted password hash** — users sign in with the same password / worker PIN as before

## What you need

1. Node 18 or newer.
2. **Service-role keys** for both projects (Supabase Dashboard → Project Settings → API → `service_role`).
   Never commit these or paste them into the browser.

## Run

```bash
OLD_SUPABASE_URL="https://<OLD-REF>.supabase.co" \
OLD_SERVICE_ROLE_KEY="<OLD service_role key>" \
NEW_SUPABASE_URL="https://ejxautrxbcemrncpzjyg.supabase.co" \
NEW_SERVICE_ROLE_KEY="<NEW service_role key>" \
node migration/auth/migrate-auth-users.mjs
```

You'll see one `.` per successful user, then a final
`Done. created=… skipped=… failed=…` summary. Already-migrated users (matched
by `id`) are skipped, so the script is safe to re-run.

## After it finishes

1. Open `/auth` and sign in as an existing user — credentials should work unchanged.
2. If you also want Google/Apple sign-in, configure those providers in the
   new project (Authentication → Providers). OAuth identities are tied to the
   provider, not migrated — but the user row itself is preserved, so on first
   OAuth sign-in the identity links to the same `id`.
3. Worker logins (phone + PIN) keep working because the synthetic
   `<digits>@workers.local` email and `wkr_<pin>_pin` password hash are
   carried over.

## Troubleshooting

- **`422 email address already exists`** — a different user in the new
  project is already using that email. Resolve manually before re-running.
- **`400 invalid password hash`** — the source hash uses an algorithm GoTrue
  can't import. Reset that user's password in the new project instead.
- **Rate limits** — if you have thousands of users, the script may hit the
  admin API rate limit; just re-run, already-created users are skipped.