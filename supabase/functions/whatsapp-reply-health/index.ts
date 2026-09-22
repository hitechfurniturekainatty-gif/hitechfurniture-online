import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "Server not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(url, serviceKey);
    const userId = userData.user.id;
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: userId, _role: "staff" }),
    ]);
    if (!isAdmin && !isStaff) return json({ error: "Office staff only" }, 403);

    const n8nConfigured = !!Deno.env.get("N8N_WHATSAPP_REPLY_WEBHOOK_URL");
    const cloudConfigured = !!(
      Deno.env.get("WHATSAPP_ACCESS_TOKEN") &&
      Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")
    );

    const { data: logs } = await admin
      .from("whatsapp_send_logs")
      .select("id,phone,gateway,status,error_message,provider_message_id,created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const recent = logs ?? [];
    const lastSuccess = recent.find((x: any) => x.status === "success") ?? null;
    const lastFailure = recent.find((x: any) => x.status === "failed") ?? null;

    return json({
      ok: true,
      connected: n8nConfigured || cloudConfigured,
      gateways: { n8n: n8nConfigured, cloud_api: cloudConfigured },
      preferred_gateway: n8nConfigured ? "n8n" : cloudConfigured ? "cloud_api" : null,
      last_success: lastSuccess,
      last_failure: lastFailure,
      recent_logs: recent,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
