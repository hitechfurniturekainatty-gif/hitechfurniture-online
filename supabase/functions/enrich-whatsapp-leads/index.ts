// NOTE: unused fallback. The live enrichment runs in n8n ("[WA] Lead AI Enrichment").
// Fills WhatsApp auto-leads (sales_leads.source = 'whatsapp') from the chat:
// name, place, requirement summary, enquiry type and budget.
//
// Called every 10 minutes by pg_cron (public.enqueue_whatsapp_lead_enrichment) with the
// shared secret header `x-enrich-secret`; the secret lives in Supabase Vault
// ('lead_enrich_secret') and is read here with the service role. Only touches leads that are still open and
// either were never enriched or got a new customer message since the last run.
// Staff edits are respected: name/place are only filled when missing or a WhatsApp handle.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const MAX_LEADS_PER_RUN = 15;
const ENQUIRY_TYPES = ["new_purchase", "custom_design", "delivery_installation", "general_inquiry"] as const;

type Lead = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_place: string | null;
  requirement: string | null;
  enquiry_type: string | null;
  suggested_amount: number | null;
  follow_up_notes: string | null;
};
type Msg = { direction: string; message_text: string | null; created_at: string };
type Extract = {
  customer_name?: string | null;
  place?: string | null;
  requirement_summary?: string | null;
  enquiry_type?: string | null;
  budget_inr?: number | null;
  is_sales_enquiry?: boolean;
  reason?: string | null;
};

const SYSTEM_PROMPT = `You read a WhatsApp chat between a customer and Hitech Furniture & Interiors (furniture showroom and interior work in Kalpetta, Wayanad, Kerala).
Return ONLY a JSON object with these keys:
- customer_name: the customer's real name if they stated it, else null. Never invent a name. Ignore Instagram-style handles.
- place: the customer's town / area if mentioned (e.g. "Meppadi", "Sulthan Bathery"), else null.
- requirement_summary: one short line (max 160 characters) of what the customer wants: items, size, material, quantity, timing. Write in the same language the customer used (Malayalam, English or Manglish). null if nothing is known.
- enquiry_type: one of "new_purchase", "custom_design", "delivery_installation", "general_inquiry". custom_design = made-to-measure / interior / carpentry work.
- budget_inr: a number if the customer stated a budget or price range (use the upper value), else null.
- is_sales_enquiry: false if this is a supplier, salesperson, job seeker, marketing agency, delivery/staff chat or spam; true otherwise.
- reason: very short reason when is_sales_enquiry is false, else null.
Lines starting with "[customer sent a ...]" mean the customer sent media you cannot see.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const isHandle = (name: string | null | undefined) =>
  !name || name === "WhatsApp customer" || !/^[\p{L}][\p{L} .'-]{1,39}$/u.test(name.trim());

const renderChat = (msgs: Msg[]) =>
  msgs
    .map((m) => {
      const who = m.direction === "incoming" ? "Customer" : "Hitech";
      const t = (m.message_text ?? "").trim();
      const media = t.match(/^I received a (\w+) message/i);
      return `${who}: ${media ? `[customer sent a ${media[1].toLowerCase()}]` : t.slice(0, 600)}`;
    })
    .join("\n");

async function askModel(chat: string): Promise<Extract | null> {
  const user = `Chat (oldest first):\n${chat}`;
  if (ANTHROPIC_API_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    const text = (d?.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return parseJson(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  }
  if (LOVABLE_API_KEY) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });
    if (!r.ok) throw new Error(`AI gateway ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    return parseJson(d?.choices?.[0]?.message?.content);
  }
  if (GEMINI_API_KEY) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
    );
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    return parseJson(d?.candidates?.[0]?.content?.parts?.[0]?.text);
  }
  throw new Error("No AI key configured (ANTHROPIC_API_KEY, LOVABLE_API_KEY or GEMINI_API_KEY)");
}

function parseJson(text: unknown): Extract | null {
  if (typeof text !== "string") return null;
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    const v = JSON.parse(cleaned);
    return v && typeof v === "object" ? (v as Extract) : null;
  } catch {
    return null;
  }
}

function buildUpdate(lead: Lead, x: Extract) {
  const patch: Record<string, unknown> = { ai_enriched_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const name = x.customer_name?.trim();
  if (name && name.length <= 60 && isHandle(lead.customer_name)) patch.customer_name = name;
  const place = x.place?.trim();
  if (place && place.length <= 80 && !lead.customer_place) patch.customer_place = place;
  const req = x.requirement_summary?.trim();
  if (req) patch.requirement = req.slice(0, 500);
  if (x.enquiry_type && (ENQUIRY_TYPES as readonly string[]).includes(x.enquiry_type)) patch.enquiry_type = x.enquiry_type;
  const budget = Number(x.budget_inr);
  if (Number.isFinite(budget) && budget > 0 && budget < 10_000_000 && !Number(lead.suggested_amount)) patch.suggested_amount = Math.round(budget);
  const marker = "AI: may not be a sales enquiry";
  if (x.is_sales_enquiry === false && !(lead.follow_up_notes ?? "").includes(marker)) {
    patch.follow_up_notes = `${marker}${x.reason ? ` — ${x.reason.slice(0, 120)}` : ""}\n${lead.follow_up_notes ?? ""}`.trim();
  }
  return patch;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const given = req.headers.get("x-enrich-secret");
  const { data: secret } = await supabase.rpc("get_lead_enrich_secret");
  if (!given || !secret || given !== secret) return json({ error: "unauthorized" }, 401);
  const { data: leads, error } = await supabase.rpc("whatsapp_leads_needing_enrichment", { p_limit: MAX_LEADS_PER_RUN });
  if (error) return json({ error: error.message }, 500);

  const results: { lead: string; ok: boolean; error?: string }[] = [];
  for (const lead of (leads ?? []) as Lead[]) {
    try {
      const { data: msgs, error: mErr } = await supabase.rpc("whatsapp_chat_for_phone", { p_phone: lead.customer_phone, p_limit: 40 });
      if (mErr) throw mErr;
      const chat = renderChat((msgs ?? []) as Msg[]);
      const patch = chat ? buildUpdate(lead, (await askModel(chat)) ?? {}) : { ai_enriched_at: new Date().toISOString() };
      const { error: uErr } = await supabase.from("sales_leads").update(patch).eq("id", lead.id);
      if (uErr) throw uErr;
      results.push({ lead: lead.id, ok: true });
    } catch (e) {
      console.error("enrich lead failed", lead.id, e);
      results.push({ lead: lead.id, ok: false, error: (e as Error).message?.slice(0, 200) });
    }
  }
  return json({ processed: results.length, ok: results.filter((r) => r.ok).length, results });
});
