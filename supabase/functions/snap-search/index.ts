// SnapSearch — identify catalog products from a photo using Lovable AI vision.
// Uses google/gemini-2.5-flash (multimodal) via the Lovable AI Gateway.
// LOVABLE_API_KEY is auto-provisioned; no user-supplied key needed.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CatalogItem = {
  id: string;
  product_name: string;
  product_code: string;
  description: string | null;
  material: string | null;
  available_colors: string[] | null;
  main_category?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image, catalog_pin } = await req.json() as {
      image?: string; // data URL or https URL
      catalog_pin?: string;
    };
    if (!image || typeof image !== "string") {
      return json({ error: "image is required (data URL or https URL)" }, 400);
    }
    if (!catalog_pin || typeof catalog_pin !== "string") {
      return json({ error: "catalog_pin is required" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI key not configured" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify the staff catalog PIN before exposing the catalog to the model.
    const { data: pinOk, error: pinErr } = await admin.rpc("verify_catalog_pin", { _pin: catalog_pin });
    if (pinErr || !pinOk) return json({ error: "Invalid catalog PIN" }, 401);

    // Pull a compact catalog snapshot — only fields useful for visual matching.
    const { data: products, error: prodErr } = await admin
      .from("products")
      .select("id, product_name, product_code, description, material, available_colors, main_category_id")
      .is("deleted_at", null)
      .limit(500);
    if (prodErr) return json({ error: prodErr.message }, 500);

    const { data: cats } = await admin.from("main_categories").select("id, name").is("deleted_at", null);
    const catMap = new Map((cats ?? []).map((c) => [c.id as string, c.name as string]));

    const compact: CatalogItem[] = (products ?? []).map((p) => ({
      id: p.id as string,
      product_name: p.product_name as string,
      product_code: p.product_code as string,
      description: (p.description as string | null) ?? null,
      material: (p.material as string | null) ?? null,
      available_colors: (p.available_colors as string[] | null) ?? null,
      main_category: catMap.get(p.main_category_id as string) ?? null,
    }));

    const systemPrompt = `You are a furniture catalog visual matcher. The user uploads a photo and you identify the closest matches from the provided catalog list.
Return ONLY a JSON object: { "matches": [{ "product_id": string, "confidence": number (0-1), "reason": string }] }.
Return up to 5 matches, ordered by confidence. Use product NAME, category, material, color and visible shape cues. If nothing matches reasonably, return { "matches": [] }.`;

    const userText = `Catalog (id | name | code | category | material | colors | description):\n` +
      compact.map((c) =>
        `${c.id} | ${c.product_name} | ${c.product_code} | ${c.main_category ?? "-"} | ${c.material ?? "-"} | ${(c.available_colors ?? []).join(",") || "-"} | ${(c.description ?? "").slice(0, 120)}`
      ).join("\n") +
      `\n\nIdentify the product(s) shown in the attached image. Respond with JSON only.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "AI rate limit hit. Try again shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
      return json({ error: `AI error: ${txt.slice(0, 300)}` }, 500);
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { matches?: { product_id: string; confidence: number; reason: string }[] };
    try { parsed = JSON.parse(content); } catch { parsed = { matches: [] }; }
    const matches = (parsed.matches ?? []).filter((m) => m && typeof m.product_id === "string");

    return json({ matches });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}