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

const cleanPhone = (value: string) => value.replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

    const body = await req.json().catch(() => ({}));
    const phone = cleanPhone(String(body?.phone ?? ""));
    const message = String(body?.message ?? "").trim();
    const customerName = body?.customer_name ? String(body.customer_name).trim() : null;

    if (phone.length < 8 || phone.length > 15) return json({ error: "Invalid phone number" }, 400);
    if (!message) return json({ error: "Message is required" }, 400);
    if (message.length > 4096) return json({ error: "Message is too long" }, 400);

    let providerMessageId: string | null = null;

    const n8nWebhook = Deno.env.get("N8N_WHATSAPP_REPLY_WEBHOOK_URL");
    const n8nSecret = Deno.env.get("N8N_WHATSAPP_REPLY_WEBHOOK_SECRET");

    if (n8nWebhook) {
      const r = await fetch(n8nWebhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(n8nSecret ? { "x-hitech-webhook-secret": n8nSecret } : {}),
        },
        body: JSON.stringify({
          phone,
          message,
          customer_name: customerName,
          source: "website_whatsapp_inbox",
          staff_user_id: userId,
        }),
      });
      const text = await r.text();
      let payload: any = null;
      try { payload = text ? JSON.parse(text) : null; } catch {}
      if (!r.ok) return json({ error: "WhatsApp gateway failed", detail: payload?.message || text || `HTTP ${r.status}` }, 502);
      providerMessageId = payload?.message_id || payload?.id || null;
    } else {
      const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      const graphVersion = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v23.0";
      if (!token || !phoneNumberId) {
        return json({
          error: "WhatsApp sending is not connected",
          detail: "Configure N8N_WHATSAPP_REPLY_WEBHOOK_URL or WhatsApp Cloud API secrets.",
        }, 503);
      }

      const r = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: "WhatsApp send failed", detail: payload?.error?.message || "Provider error" }, 502);
      providerMessageId = payload?.messages?.[0]?.id || null;
    }

    const { data: inserted, error: insertErr } = await admin
      .from("whatsapp_messages")
      .insert({
        phone,
        customer_name: customerName,
        direction: "outgoing",
        message_text: message,
      })
      .select("id,phone,customer_name,direction,message_text,created_at")
      .single();

    if (insertErr) {
      return json({ ok: true, warning: "Message sent but local chat history update failed", provider_message_id: providerMessageId });
    }

    return json({ ok: true, message: inserted, provider_message_id: providerMessageId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
