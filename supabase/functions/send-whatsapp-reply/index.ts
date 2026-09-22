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

type GatewayResult = {
  ok: boolean;
  gateway: "n8n" | "cloud_api";
  providerMessageId?: string | null;
  error?: string;
};

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

    const attempts: GatewayResult[] = [];

    const writeLog = async (result: GatewayResult) => {
      await admin.from("whatsapp_send_logs").insert({
        phone,
        gateway: result.gateway,
        status: result.ok ? "success" : "failed",
        error_message: result.error ?? null,
        provider_message_id: result.providerMessageId ?? null,
        staff_user_id: userId,
      });
    };

    const sendViaN8n = async (): Promise<GatewayResult | null> => {
      const webhook = Deno.env.get("N8N_WHATSAPP_REPLY_WEBHOOK_URL");
      if (!webhook) return null;
      const secret = Deno.env.get("N8N_WHATSAPP_REPLY_WEBHOOK_SECRET");
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const r = await fetch(webhook, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(secret ? { "x-hitech-webhook-secret": secret } : {}),
          },
          body: JSON.stringify({
            phone,
            message,
            customer_name: customerName,
            source: "website_whatsapp_inbox",
            staff_user_id: userId,
          }),
        });
        clearTimeout(timer);
        const text = await r.text();
        let payload: any = null;
        try { payload = text ? JSON.parse(text) : null; } catch {}
        if (!r.ok) {
          return { ok: false, gateway: "n8n", error: payload?.message || text || `HTTP ${r.status}` };
        }
        return { ok: true, gateway: "n8n", providerMessageId: payload?.message_id || payload?.id || null };
      } catch (e) {
        return { ok: false, gateway: "n8n", error: e instanceof Error ? e.message : "n8n request failed" };
      }
    };

    const sendViaCloudApi = async (): Promise<GatewayResult | null> => {
      const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      const graphVersion = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v23.0";
      if (!token || !phoneNumberId) return null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const r = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
          method: "POST",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone,
            type: "text",
            text: { preview_url: false, body: message },
          }),
        });
        clearTimeout(timer);
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) {
          return { ok: false, gateway: "cloud_api", error: payload?.error?.message || `HTTP ${r.status}` };
        }
        return { ok: true, gateway: "cloud_api", providerMessageId: payload?.messages?.[0]?.id || null };
      } catch (e) {
        return { ok: false, gateway: "cloud_api", error: e instanceof Error ? e.message : "Cloud API request failed" };
      }
    };

    const n8nResult = await sendViaN8n();
    if (n8nResult) {
      attempts.push(n8nResult);
      await writeLog(n8nResult);
    }

    let sent = n8nResult?.ok ? n8nResult : null;

    if (!sent) {
      const cloudResult = await sendViaCloudApi();
      if (cloudResult) {
        attempts.push(cloudResult);
        await writeLog(cloudResult);
        if (cloudResult.ok) sent = cloudResult;
      }
    }

    if (!sent) {
      const configured = {
        n8n: !!Deno.env.get("N8N_WHATSAPP_REPLY_WEBHOOK_URL"),
        cloud_api: !!(Deno.env.get("WHATSAPP_ACCESS_TOKEN") && Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")),
      };
      const detail = attempts.length
        ? attempts.map((a) => `${a.gateway}: ${a.error || "failed"}`).join(" | ")
        : "No WhatsApp send gateway is configured.";
      return json({ error: "WhatsApp send failed", detail, configured, attempts }, 502);
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
      return json({
        ok: true,
        warning: "Message sent but local chat history update failed",
        gateway: sent.gateway,
        provider_message_id: sent.providerMessageId ?? null,
      });
    }

    return json({
      ok: true,
      gateway: sent.gateway,
      message: inserted,
      provider_message_id: sent.providerMessageId ?? null,
      fallback_used: !!n8nResult && !n8nResult.ok && sent.gateway === "cloud_api",
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
