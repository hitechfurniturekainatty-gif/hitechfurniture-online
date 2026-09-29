# Hitech disaster-recovery runbook (not yet deployed)

## Acceptance criteria
**Do not mark recovery ready until every check below passes on an isolated Hostinger VPS with Supabase cloud network access disabled.** The current n8n JSON export is a convenience export, *not* a PostgreSQL disaster-recovery dump.

1. A secured, independently managed Hostinger VPS runs a **version-pinned self-hosted Supabase stack** (Postgres, GoTrue/Auth, PostgREST, Storage, Realtime, Studio, Edge Functions and API gateway). Limit PostgreSQL, Studio, and management ports to a VPN/private network. Apply TLS, least privilege and patching.
2. Before each backup verify `supabase db dump` with a Supabase CLI version matching production. Generate `roles.sql`, `schema.sql`, and `data.sql` (see official platform-to-self-hosted guide). Also inventory extensions, RLS policies, database triggers, functions, sequences, and migration history.
3. Restore the `auth` schema with compatible versions/configuration, user IDs, identities and password hashes; protect SMTP, JWT secret and signing-key configuration separately in an encrypted secret manager. Revoke/reissue tokens and force re-login on failover if necessary. Confirm admin, sales and carpenter access, deny unauthorized access and test sign-in and password reset. Never copy plaintext passwords or publish exports.
4. Back up EVERY Storage bucket, including private `quotations`, using server-side credentials rather than anonymous downloads. Keep the original bucket/path and checksum/size per object. Compare expected vs restored object inventories; do not flatten object paths. Storage object metadata alone is insufficient.
5. Version-control every Edge Function's deployable source and deployment configuration. Recreate private function secrets on Hostinger. Verify webhooks, WhatsApp, inventory, enquiry and quotation flows.
6. Use a private, encrypted, off-VPS, immutable/versioned second copy of each database dump, file manifest and blob. Verify transfer checksums. Keep snapshots long enough to recover from unnoticed deletion.
7. Build `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for either primary or recovery environment. Frontend config is **build-time**; changing a .env file without rebuilding/redeploying the app does not switch an already published Vite bundle. A DNS/reverse-proxy failover design needs separately tested routing, Auth redirect URLs and TLS.
8. Restore into isolated Hostinger test environment; run read + write tests across every role, private media, quotations, orders, inventory, realtime and functions. Verify with primary Supabase blocked. Document measured recovery point (RPO) and recovery time (RTO). Daily backup alone can lose all data since last run. For lower RPO, design and validate WAL/streaming replication with compatible Postgres infrastructure and a clear single-writer cutover protocol. Never auto-enable simultaneous writes on both sites.

## Current blockers (audit 2026-09-29)
- n8n workflow `[Backup] Daily Supabase to Hostinger` has failed daily. Its raw JSON DB upload can succeed while Storage backup fails; do not treat this as complete success.
- The `quotations` bucket is **private**, but the n8n `Download Storage File` HTTP node is configured with `authentication: none`. The production download returned `Bucket not found`. Configure a **server-only secret credential** that is authorized to read private objects; test a representative object. Never make the private bucket public or put a service-role key in code.
- Product-image uploads in n8n were successful for 75 objects on the inspected run; 106 quotation object records still require independent verification.
- n8n's schedule is currently set to a Europe/Berlin timezone, not Asia/Kolkata. Explicitly set the workflow timezone before claiming local 2 AM backups.
- The DB function `generate_full_backup()` serializes public tables, migration history, and an incomplete subset of `auth.users`. It does **not** produce a complete PostgreSQL schema/roles dump or an independently restorable GoTrue/auth state.
- Hostinger VPS access/plan and offsite backup destination have not been verified through available connections. Do not overwrite current production, create a cutover, or claim recovery ready without an end-to-end restore.

## Execution order
1. Check backup secrets and make private Storage download work; alert on *any* failed stage. Verify every file checksum and counts for each bucket.
2. Produce database roles/schema/data dumps plus the dedicated Storage and Edge Function/secret inventories. Encrypt and store in Hostinger *and* independent offsite storage.
3. Provision isolated Hostinger VPS self-hosted Supabase and restore matching component versions, encrypted credentials and files.
4. Build recovery frontend against Hostinger and exercise every workflow with primary Supabase unavailable.
5. Only after acceptance tests and a written runbook, introduce deliberate cutover/rollback and ongoing restore drills.

## Official reference
https://supabase.com/docs/guides/self-hosting/restore-from-platform

**Warning:** This document and the accompanying frontend configuration PR improve preparedness but do not deploy a recovery server or provide zero-downtime guarantees.
