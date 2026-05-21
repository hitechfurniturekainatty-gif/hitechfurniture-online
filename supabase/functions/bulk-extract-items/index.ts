// Edge function that turns free-form text (from a PDF/Word doc or pasted
// content) into a clean JSON array of quotation line items using the Lovable
// AI Gateway. The client extracts the text first; this function only does the
// structured-extraction step so we don't ship a huge PDF/DOCX parser to Deno.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface Item {
  description: string;
  quantity: number;
  measurement?: string | null;
  unit_price?: number | null;
  fulfillment_route?: 'ready_stock' | 'custom';
  image_hint?: string | null;
}

const SYSTEM_PROMPT = `You convert raw furniture/quotation text into clean JSON line items.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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
          { role: 'system', content: SYSTEM_PROMPT },
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
    let parsed: { items?: Item[] } = {};
    try { parsed = JSON.parse(content); } catch { parsed = { items: [] }; }
    const items = Array.isArray(parsed.items) ? parsed.items.filter((i) => i?.description) : [];
    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});