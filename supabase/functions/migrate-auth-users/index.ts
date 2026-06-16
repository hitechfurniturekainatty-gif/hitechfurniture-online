// Temporary one-shot migration tool. Accepts CSV of auth.users rows
// (exported from the old project) and recreates them in NEW_PROJECT_URL
// via the Admin API, preserving id + password hash.
//
// POST { csv: "<full csv text>" }
// Header required: x-migration-token: <NEW_PROJECT_SERVICE_ROLE_KEY>
//   (we re-use the service-role key as a shared secret so this endpoint
//   is not callable by anyone with the anon key.)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  // Minimal RFC-4180 parser: handles quoted fields, embedded quotes,
  // commas, and newlines.
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => v && v.length > 0))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])) as Row);
}

function parseJsonField(v: string | undefined): unknown {
  if (!v || v === "" || v === "null") return {};
  try { return JSON.parse(v); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const NEW_URL = Deno.env.get("NEW_PROJECT_URL");
  const NEW_KEY = Deno.env.get("NEW_PROJECT_SERVICE_ROLE_KEY");
  if (!NEW_URL || !NEW_KEY) {
    return new Response(JSON.stringify({ error: "Missing NEW_PROJECT_URL / NEW_PROJECT_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = req.headers.get("x-migration-token");
  if (token !== NEW_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized — pass NEW_PROJECT_SERVICE_ROLE_KEY in x-migration-token header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: { csv?: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  if (!body.csv || typeof body.csv !== "string") {
    return new Response(JSON.stringify({ error: "Body must be { csv: \"...\" }" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const rows = parseCsv(body.csv);
  const results: { email: string; status: "created" | "skipped" | "failed"; detail?: string }[] = [];
  let created = 0, skipped = 0, failed = 0;

  const base = NEW_URL.replace(/\/+$/, "");
  const headers = {
    "apikey": NEW_KEY,
    "Authorization": `Bearer ${NEW_KEY}`,
    "Content-Type": "application/json",
  };

  for (const row of rows) {
    const email = (row.email || "").trim();
    if (!email && !row.phone) {
      failed++; results.push({ email: "(no email/phone)", status: "failed", detail: "missing identifier" });
      continue;
    }

    const payload: Record<string, unknown> = {
      id: row.id || undefined,
      email: email || undefined,
      phone: row.phone || undefined,
      password_hash: row.encrypted_password || undefined, // preserves bcrypt hash
      email_confirm: !!row.email_confirmed_at,
      phone_confirm: !!row.phone_confirmed_at,
      user_metadata: parseJsonField(row.raw_user_meta_data),
      app_metadata: parseJsonField(row.raw_app_meta_data),
    };

    try {
      const r = await fetch(`${base}/auth/v1/admin/users`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      if (r.status === 200 || r.status === 201) {
        created++; results.push({ email, status: "created" });
      } else if (r.status === 422 && /already (registered|exists)/i.test(text)) {
        skipped++; results.push({ email, status: "skipped", detail: "already exists" });
      } else {
        failed++; results.push({ email, status: "failed", detail: `${r.status} ${text.slice(0, 200)}` });
      }
    } catch (e) {
      failed++; results.push({ email, status: "failed", detail: String(e) });
    }
  }

  return new Response(JSON.stringify({
    total: rows.length, created, skipped, failed, results,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});