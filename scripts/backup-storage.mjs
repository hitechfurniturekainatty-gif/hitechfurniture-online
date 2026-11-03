#!/usr/bin/env node
/**
 * Server-side Supabase Storage backup. NEVER import this from browser code.
 * Usage (on secured backup runner): SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
 *   BACKUP_ROOT=/private/backup EXPECTED_BUCKETS=product-images,quotations,staff-diary
 *   node scripts/backup-storage.mjs
 * Requires Node >=20; uses @supabase/supabase-js from package.json.
 * Output is a PRIVATE local snapshot + checksummed manifest. Separate encrypted
 * offsite replication and restore validation are still mandatory.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error('Missing required server environment: ' + name);
  return value;
};
const url = required('SUPABASE_URL');
const key = required('SUPABASE_SERVICE_ROLE_KEY');
const root = resolve(required('BACKUP_ROOT'));
const expectedBuckets = required('EXPECTED_BUCKETS').split(',').map(s => s.trim()).filter(Boolean);
if (!expectedBuckets.length || new Set(expectedBuckets).size !== expectedBuckets.length) {
  throw new Error('Provide distinct EXPECTED_BUCKETS explicitly');
}
await mkdir(root, { recursive: true, mode: 0o700 });
const client = createClient(url, key, {auth: { persistSession: false, autoRefreshToken: false }});
const {data: buckets, error: bucketError} = await client.storage.listBuckets();
if (bucketError) throw new Error('Cannot enumerate Storage buckets: ' + bucketError.message);
const actual = new Set(buckets.map(b => b.id));
for (const bucket of expectedBuckets) {
  if (!actual.has(bucket)) throw new Error('Expected bucket missing: ' + bucket);
}
if (actual.size !== expectedBuckets.length) throw new Error('Unexpected bucket(s): update EXPECTED_BUCKETS before backup');
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID();
const staging = join(root, '.' + id);
const final = join(root, id);
const manifest = { createdAt: new Date().toISOString(), buckets: {}, files: [] };
const safeSegment = name => {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error('Unsafe object path component');
  }
  return name;
};
async function walk(bucket, prefix='') {
  let offset = 0;
  let count = 0;
  while (true) {
    const {data, error} = await client.storage.from(bucket).list(prefix, {
      limit: 100, offset, sortBy: {column: 'name', order: 'asc'}
    });
    if (error) throw new Error('Storage listing failed for ' + bucket + ': ' + error.message);
    if (!data) throw new Error('No Storage listing returned for ' + bucket);
    for (const obj of data) {
      safeSegment(obj.name);
      const path = prefix ? prefix + '/' + obj.name : obj.name;
      if (!obj.id) { await walk(bucket, path); continue; } // virtual folder
      const {data: blob, error: downloadError} = await client.storage.from(bucket).download(path);
      if (downloadError || !blob) throw new Error('Storage download failed in ' + bucket + ': ' + (downloadError?.message || 'empty response'));
      const bytes = Buffer.from(await blob.arrayBuffer());
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const relative = ['objects', safeSegment(bucket), ...path.split('/').map(safeSegment)];
      const destination = join(staging, ...relative);
      await mkdir(resolve(destination, '..'), {recursive: true, mode: 0o700});
      const handle = await open(destination, 'wx', 0o600);
      try { await handle.writeFile(bytes); } finally { await handle.close(); }
      manifest.files.push({ bucket, path, size: bytes.length, sha256 });
      count++;
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return count;
}
try {
  await mkdir(staging, {mode: 0o700});
  for (const bucket of expectedBuckets) {
    const start = manifest.files.length;
    await walk(bucket);
    manifest.buckets[bucket] = manifest.files.length - start;
  }
  manifest.files.sort((a,b) => (a.bucket + '/' + a.path).localeCompare(b.bucket + '/' + b.path));
  await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  // Verify bytes at rest before exposing snapshot as complete.
  for (const file of manifest.files) {
    const filePath = join(staging, 'objects', file.bucket, ...file.path.split('/'));
    const actualSize = (await stat(filePath)).size;
    if (actualSize !== file.size) throw new Error('Local size mismatch: ' + file.bucket);
  }
  await rename(staging, final);
  console.log('Local Storage snapshot complete:', final);
  for (const [name, count] of Object.entries(manifest.buckets)) console.log(name + ': ' + count + ' files');
  console.log('Not disaster-recovery complete until encrypted offsite copy and isolated restore pass.');
} catch (err) {
  await rm(staging, {recursive: true, force: true});
  console.error(err.message);
  process.exitCode = 1;
}
