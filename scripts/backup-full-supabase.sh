#!/usr/bin/env bash
# Hitech: encrypted external backup infrastructure prerequisite.
# RUN ONLY on a secured backup runner with Supabase CLI + Docker installed.
# This script dumps roles, schema and data; it is NOT the storage/secret backup.
set -Eeuo pipefail
umask 077

: "${SUPABASE_DATABASE_URL:?Set the source database URL in a protected server environment}"
: "${BACKUP_ROOT:?Set a private backup directory (not a web-served directory)}"
command -v supabase >/dev/null || { echo "Supabase CLI required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum required" >&2; exit 1; }

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp="$(mktemp -d "${BACKUP_ROOT%/}/.hitech-${timestamp}.XXXXXX")"
final="${BACKUP_ROOT%/}/hitech-db-${timestamp}"
trap 'test -d "$tmp" && rm -rf "$tmp"' EXIT

# Official Supabase migration-compatible exports. Auth/storage objects and
# secret-bearing config MUST be backed up independently and restored/tested.
supabase db dump --db-url "$SUPABASE_DATABASE_URL" -f "$tmp/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DATABASE_URL" -f "$tmp/schema.sql"
supabase db dump --db-url "$SUPABASE_DATABASE_URL" -f "$tmp/data.sql" --use-copy --data-only

for name in roles schema data; do
  test -s "$tmp/$name.sql" || { echo "Empty $name dump; aborting" >&2; exit 1; }
done
(cd "$tmp" && sha256sum roles.sql schema.sql data.sql > SHA256SUMS && sha256sum -c SHA256SUMS)
printf '%s\n' "$timestamp" > "$tmp/UTC_BACKUP_ID"
# Atomic publish on the same filesystem. Immediately encrypt and replicate
# to independent versioned offsite storage using approved server operations.
mv "$tmp" "$final"
trap - EXIT
printf 'DB export and local checksums passed: %s\n' "$final"
printf 'NOT complete recovery: must verify Storage, Auth compatibility, Functions, offsite encryption and isolated restore.\n'
