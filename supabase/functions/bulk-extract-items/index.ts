// Edge function that turns free-form text (from a PDF/Word doc or pasted
// content) into a clean JSON array of quotation line items using the Lovable
// AI Gateway. The client extracts the text first; this function only does the
// structured-extraction step so we don't ship a huge PDF/DOCX parser to Deno.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const QUOTATION_PROMPT = `You convert raw furniture/quotation text into clean JSON line items.
Return ONLY a JSON object like:
{"items":[{"description":"Sofa 3-seater","quantity":2,"measurement":"180x90 cm","unit_price":12500,"fulfillment_route":"ready_stock","image_hint":"sofa.jpg"}]}

Rules:
- description: short product name (required, max 120 chars).
- quantity: positive number (default 1 if unclear).
- measurement: dimensions string or null.
- unit_price: number in INR without symbols, or null if missing.
- fulfillment_route: "custom" only if text says custom/made-to-order, else "ready_stock".
- image_hint: any filename mentioned for that row, else null.
- Skip header rows, totals, GST, taxes, grand-total lines.
- Never invent data.`;

const PRODUCT_PROMPT = `You convert raw catalog/product text into clean JSON product rows.
Return ONLY a JSON object like:
{"items":[{"product_name":"Recliner Sofa","product_code":"RS-101","description":"Brown leather","mrp":35000,"offer_price":29999,"cost_price":21000,"material":"Leather","dimensions":"180x90x85 cm","stock_quantity":4,"category":"Sofas","image_hint":"recliner.jpg"}]}

Rules:
- product_name: required, max 120 chars.
- product_code: short SKU or null.
- mrp / offer_price / cost_price: numbers in INR with no symbols, or null.
- stock_quantity: non-negative integer (default 0).
- category: main category name as written, or null.
- image_hint: filename mentioned for the row, or null.
- Skip header rows and totals. Never invent data.`;

const BUNDLE_PROMPT = `You convert raw bundle/combo-set text into clean JSON bundle rows.
Return ONLY a JSON object like:
{"items":[{"name":"Living Room Combo","bundle_code":"BND-101","description":"Sofa+table+chairs","mrp":78000,"offer_price":69000,"cost_price":52000,"material":"Wood/Fabric","dimensions":null,"category":"Living Room","image_hint":"combo.jpg","linked_products":[{"product_code":"SOFA-3S","quantity":1},{"product_code":"CT-22","quantity":1}]}]}

Rules:
- name: required, max 120 chars.
- bundle_code: short code or null.
- mrp / offer_price / cost_price: numbers in INR, or null.
- linked_products: array of { product_code, quantity } if text lists components, else [].
- category: main category name, or null.
- Skip headers and totals. Never invent data.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { text, kind } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const promptByKind: Record<string, string> = {
      quotation: QUOTATION_PROMPT,
      product: PRODUCT_PROMPT,
      bundle: BUNDLE_PROMPT,
    };
    const systemPrompt = promptByKind[String(kind ?? 'quotation')] ?? QUOTATION_PROMPT;
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI gateway not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.slice(0, 60_000) },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit, try again shortly' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted — top up Lovable AI' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `AI error: ${t.slice(0, 200)}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: { items?: any[] } = {};
    try { parsed = JSON.parse(content); } catch { parsed = { items: [] }; }
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter((i: any) => i?.description || i?.product_name || i?.name)
      : [];
    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});