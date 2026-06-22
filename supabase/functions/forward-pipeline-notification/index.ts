// Forwards every new pipeline_notifications row to an external n8n webhook
// (URL stored in the N8N_WEBHOOK_URL secret). Called by an AFTER-INSERT
// trigger on pipeline_notifications via pg_net.
//
// If N8N_WEBHOOK_URL is unset, the function logs and returns 200 — that lets
// the trigger fire harmlessly until the n8n endpoint is provisioned.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_WEBHOOK_URL = Deno.env.get("N8N_WEBHOOK_URL") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: { notification_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const notificationId = body.notification_id;
  if (!notificationId) {
    return new Response(JSON.stringify({ error: "notification_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Load notification + quotation context for enrichment.
  const { data: n, error: nErr } = await admin
    .from("pipeline_notifications")
    .select("id, quotation_id, stage, target_role, title, body, created_at")
    .eq("id", notificationId)
    .maybeSingle();
  if (nErr || !n) {
    return new Response(JSON.stringify({ error: nErr?.message ?? "notification not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: q } = await admin
    .from("quotations")
    .select(
      "id, quotation_id, party_name, party_place, party_phone, party_address, total, advance_amount, status, pipeline_stage, salesperson_name, expected_delivery_date",
    )
    .eq("id", n.quotation_id)
    .maybeSingle();

  const total = Number(q?.total ?? 0);
  const advance = Number(q?.advance_amount ?? 0);
  // NOTE: advance_amount is currently the ONLY payment column on quotations
  // (no partial-payment ledger yet — see section 7 of the audit). Once a
  // payments table is introduced, swap this for SUM(payments.amount).
  const balance_due = Math.max(total - advance, 0);

  const payload = {
    notification: {
      id: n.id,
      stage: n.stage,
      target_role: n.target_role,
      title: n.title,
      body: n.body,
      created_at: n.created_at,
    },
    quotation: q
      ? {
          id: q.id,
          quotation_id: q.quotation_id,
          party_name: q.party_name,
          party_place: q.party_place,
          party_phone: q.party_phone,
          party_address: q.party_address,
          status: q.status,
          pipeline_stage: q.pipeline_stage,
          salesperson_name: q.salesperson_name,
          expected_delivery_date: q.expected_delivery_date,
          total,
          advance_amount: advance,
          balance_due,
        }
      : null,
  };

  if (!N8N_WEBHOOK_URL) {
    console.log("[forward-pipeline-notification] N8N_WEBHOOK_URL not configured; skipping POST", {
      notification_id: n.id,
    });
    return new Response(JSON.stringify({ ok: true, forwarded: false, reason: "no_url" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return new Response(
      JSON.stringify({ ok: res.ok, forwarded: true, status: res.status, response: text.slice(0, 500) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[forward-pipeline-notification] POST failed", e);
    return new Response(
      JSON.stringify({ ok: false, forwarded: false, error: (e as Error).message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});