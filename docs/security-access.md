# Access hardening

The production Supabase project is `ejxautrxbcemrncpzjyg`.

- Auth signup creates a profile, not a staff role. Verified administrator endpoints provision roles.
- Public catalogue reads exclude supplier cost. Public bundle pages must select explicit public columns, never `*`.
- Integration policies are scoped to `service_role`; office analytics gets read-only access to WhatsApp logs.
- Internal workflow helpers and trigger functions are not executable by API users. Public share RPCs deliberately accept an unguessable document token and reject deleted documents.
- Product asset changes require office roles. Quotation attachment writes require a staff/worker role; non-office users may update/delete only their own uploads.
- Quotation attachment reads require office access, ownership, or a document/item visible through RLS.
- `private-media` verifies either the signed-in user or a valid document share token before issuing one-hour signed URLs. A share token authorizes only files included in that document's server-side payload.
- The frontend persists canonical object references and resolves display URLs on read. Do not persist signed URLs in integrations; they expire. Reload a long-open page to renew display URLs.
- AI extraction, image search and Excel export require authorized staff. Automated Excel exports and pipeline forwarding must supply a server-held service credential; never put it in frontend code or a URL.

## Verification

Run `npm test -- --passWithNoTests`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run build`.
Run `supabase/tests/security_access.sql` as the database owner. Its synthetic signup/admin/worker records and storage writes are rolled back. It checks anonymous cost and upload denial, roleless access denial, invalid share tokens, administrator access, and unrelated worker attachment denial.

## Rollout and remaining checks

The `private-media` Edge Function is deployed and the signed-URL frontend is on main with a successful production CI run. The quotations bucket was switched to private in migration `20260908183505`. Existing tabs must refresh to use signed URLs. Product images stay public for the catalogue. The hosting provider's deployed frontend and live upload/share-link flow still need verification.

Supabase leaked-password protection is an Auth dashboard setting and requires separate verification. Security-definer RPC warnings can remain for deliberately privileged, authorized operations; inspect each rather than suppressing the advisor. The `pg_trgm` public-schema advisory requires a separate dependency-aware migration.

This change is not a full infrastructure penetration test. Review hosting, backups, n8n webhook authentication, and internal column-level price permissions separately; a successful build does not prove those controls.

## Supplier-cost rollout (2026-09-08)

The authorized `get_catalog_costs` RPC and role-masked catalogue views are active. The frontend adapter requests public columns and retrieves supplier costs in bounded batches; PostgreSQL checks Admin/Office membership. Other roles receive no cost values from these endpoints. Price-history RLS already limits reads to office roles.

**Active:** authenticated base-table column revocation was applied in migration `20260909010613`. The supplied Hostinger deployment screenshot reports commit `2ddf2ff0` completed on 2026-09-09; its client and adapter blobs match the tested cost-access release. Both SQL role/access suites passed after activation. Direct authenticated cost-column access is revoked; Admin/Office reads use the guarded RPC. Existing browser tabs should refresh. Live interactive UI testing remains outstanding.

After activation, verify authenticated `has_column_privilege` is false for both base tables, then run `supabase/tests/catalog_cost_access.sql` and the existing access tests. Test Admin product editing, Staff catalogue, Warehouse inventory and public bundles in the deployed UI. The cost-role SQL test rolls back all synthetic identities and prints no supplier prices.
