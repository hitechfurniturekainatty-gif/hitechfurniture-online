#!/usr/bin/env node
/**
 * ISOLATED HOSTINGER RECOVERY ACCEPTANCE TEST (read + write).
 * Run only against a RESTORED TEST INSTANCE, never production. Requires Node >=20.
 * Never print passwords, bearer tokens or service keys.
 * Provision a test-only table first:
 *   CREATE TABLE public.dr_smoke_test (id uuid PRIMARY KEY, message text NOT NULL);
 *   ALTER TABLE public.dr_smoke_test ENABLE ROW LEVEL SECURITY;
 * Use a server-side service role for isolated backup verification.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error('Missing ' + name);
  return value;
};
const backup = resolve(required('STORAGE_SNAPSHOT'));
const manifest = JSON.parse(await readFile(join(backup, 'manifest.json'), 'utf8'));
const endpoint = required('RECOVERY_SUPABASE_URL');
const serviceKey = required('RECOVERY_SERVICE_ROLE_KEY');
if (!process.env.RECOVERY_ISOLATED_TEST || process.env.RECOVERY_ISOLATED_TEST !== 'yes') {
  throw new Error('Explicit RECOVERY_ISOLATED_TEST=yes required');
}
const prodRef = 'ejxautrxbcemrncpzjyg';
if (endpoint.includes(prodRef) || !endpoint.startsWith('https://')) {
  throw new Error('Refusing production/non-HTTPS target');
}
const client = createClient(endpoint, serviceKey, {auth: {autoRefreshToken: false, persistSession: false}});
const failures = [];
async function check(name, fn) {
  try { await fn(); console.log('PASS ' + name); }
  catch(e) { failures.push(name + ': ' + e.message); console.error('FAIL ' + name + ': ' + e.message); }
}
await check('DB read / quotations', async () => {
  const {error} = await client.from('quotations').select('id', {count:'exact',head:true});
  if (error) throw error;
});
await check('Database reversible isolated write', async () => {
  const id = randomUUID();
  const {error} = await client.from('dr_smoke_test').insert({id, message:'isolated recovery verification'});
  if (error) throw error;
  try {
    const {data, error:readErr} = await client.from('dr_smoke_test').select('id').eq('id',id).single();
    if (readErr || data?.id !== id) throw (readErr || Error('Test row not readable'));
  } finally {
    const {error:deleteErr} = await client.from('dr_smoke_test').delete().eq('id',id);
    if (deleteErr) throw deleteErr;
  }
});
await check('Storage manifest checksums / restored objects', async () => {
  const {data: buckets,error:bErr} = await client.storage.listBuckets();
  if (bErr) throw bErr;
  const names = new Set(buckets.map(b=>b.id));
  for (const bucket of Object.keys(manifest.buckets)) if (!names.has(bucket)) throw Error('Missing bucket '+bucket);
  for (const f of manifest.files) {
    const path = join(backup,'objects',f.bucket,...f.path.split('/'));
    const bytes = await readFile(path);
    if (bytes.length!==f.size || createHash('sha256').update(bytes).digest('hex')!==f.sha256) {
      throw Error('Corrupt backup bytes: '+f.bucket+'/'+f.path);
    }
    const {data,error} = await client.storage.from(f.bucket).download(f.path);
    if (error || !data) throw Error('Restored object missing in '+f.bucket+': '+(error?.message||f.path));
    const restored=Buffer.from(await data.arrayBuffer());
    if (restored.length!==f.size || createHash('sha256').update(restored).digest('hex')!==f.sha256) {
      throw Error('Restored object mismatch: '+f.bucket+'/'+f.path);
    }
  }
});
await check('Staff login credentials / role verification',async()=>{
  const roles=['ADMIN','SALES','CARPENTER'];
  for(const role of roles){
    const email=required('RECOVERY_TEST_'+role+'_EMAIL');
    const password=required('RECOVERY_TEST_'+role+'_PASSWORD');
    const publishable=required('RECOVERY_PUBLISHABLE_KEY');
    const userClient=createClient(endpoint,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await userClient.auth.signInWithPassword({email,password});
    if(error || !data?.user)throw Error(role+' login failed: '+(error?.message||'no user'));
    const {data:roleRows,error:roleError}=await userClient.from('user_roles').select('role').eq('user_id',data.user.id);
    if(roleError)throw Error(role+' role query failed: '+roleError.message);
    if(!roleRows?.length)throw Error(role+' has no role in restored database');
    await userClient.auth.signOut();
  }
});
console.log('Result:', failures.length ? failures.length+' failure(s)' : 'all tested checks passed');
if(failures.length)process.exitCode=1;
console.log('Edge functions, realtime and external WhatsApp require additional domain-specific acceptance tests.');
