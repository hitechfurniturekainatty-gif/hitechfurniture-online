// Meta Conversions API relay: Lead / Contact events from hitechfurniture.online
// Copied from the live deployment (version 3) on 2026-11-24 so the code is kept in GitHub.
// Secret needed: META_CAPI_TOKEN.
const PIXEL = "964014666331501";
const cors = { "Access-Control-Allow-Origin": "https://hitechfurniture.online", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const ALLOWED = new Set(["Lead", "Contact"]);
async function sha(v: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = Deno.env.get("META_CAPI_TOKEN");
  if (!token) return new Response(JSON.stringify({ ok: false, reason: "no_token" }), { headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const b = await req.json();
    if (!ALLOWED.has(b.event_name) || !b.event_id) return new Response("bad", { status: 400, headers: cors });
    const ud: Record<string, unknown> = { client_user_agent: req.headers.get("user-agent") ?? undefined, client_ip_address: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined, country: [await sha("in")] };
    if (b.fbp) ud.fbp = b.fbp; if (b.fbc) ud.fbc = b.fbc;
    let ph = String(b.phone ?? "").replace(/\D/g, ""); if (ph.length === 10) ph = "91" + ph; if (ph.length >= 11) ud.ph = [await sha(ph)];
    const fn = String(b.name ?? "").trim().toLowerCase().split(/\s+/)[0]; if (fn) ud.fn = [await sha(fn)];
    const ct = String(b.place ?? "").trim().toLowerCase().replace(/[^a-z]/g, ""); if (ct) ud.ct = [await sha(ct)];
    const ev = { event_name: b.event_name, event_time: Math.floor(Date.now() / 1000), event_id: String(b.event_id), action_source: "website", event_source_url: String(b.url ?? "https://hitechfurniture.online/"), user_data: ud, custom_data: { content_category: b.category ?? undefined, content_name: b.channel ?? undefined } };
    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL}/events?access_token=${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [ev] }) });
    const j = await r.json();
    return new Response(JSON.stringify({ ok: r.ok, meta: j }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: cors }); }
});
