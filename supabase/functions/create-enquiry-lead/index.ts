// Public endpoint that turns a website enquiry into a draft quotation (lead).
// No auth required — uses the service role to bypass RLS.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const customerName = String(body.customerName || "").trim();
    const phone = String(body.phone || "").trim();
    const location = String(body.location || "").trim();
    const category = String(body.category || "Enquiry").trim();
    const summary = String(body.summary || "").trim();
    const productId: string | null = body.productId || null;
    const productName: string | null = body.productName || null;
    const productImage: string | null = body.productImage || null;
    const productCode: string | null = body.productCode || null;
    const itemsIn: Array<{
      description?: string;
      quantity?: number;
      productId?: string | null;
      productImageUrl?: string | null;
      productCode?: string | null;
      // Customer-uploaded reference image as data URL (base64)
      uploadImageBase64?: string | null;
      uploadImageName?: string | null;
    }> = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !phone || !location) {
      return new Response(
        JSON.stringify({ error: "customerName, phone, location are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: qid, error: idErr } = await supabase.rpc("next_quotation_id", {
      _party: customerName,
      _place: location,
    });
    if (idErr) throw idErr;

    const notes = [
      `Website enquiry — ${category}`,
      productName ? `Product: ${productName}${productCode ? ` (${productCode})` : ""}` : null,
      summary || null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: q, error: qErr } = await supabase
      .from("quotations")
      .insert({
        quotation_id: qid,
        party_name: customerName,
        party_place: location,
        party_phone: phone,
        notes,
        salesperson_name: "Website Enquiry",
        lead_type: "lead",
        status: "drafted",
        pipeline_stage: 1,
      })
      .select("id")
      .single();
    if (qErr) throw qErr;

    // Helper: upload a base64 data URL to storage and return its public URL.
    const uploadDataUrl = async (dataUrl: string, hintName?: string | null) => {
      try {
        const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
        if (!m) return null;
        const mime = m[1];
        const b64 = m[2];
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const ext = (mime.split("/")[1] || "jpg").split("+")[0];
        const safeHint = (hintName || "ref").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
        const path = `enquiries/${q.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeHint}.${ext}`;
        const { error } = await supabase.storage
          .from("quotation-images")
          .upload(path, bin, { contentType: mime, upsert: false });
        if (error) {
          console.error("upload failed", error);
          return null;
        }
        return supabase.storage.from("quotation-images").getPublicUrl(path).data.publicUrl;
      } catch (e) {
        console.error("uploadDataUrl error", e);
        return null;
      }
    };

    // Build the list of items to insert.
    const rows: Array<Record<string, unknown>> = [];
    if (itemsIn.length > 0) {
      for (const it of itemsIn) {
        let imageUrl: string | null = it.productImageUrl || null;
        if (!imageUrl && it.uploadImageBase64) {
          imageUrl = await uploadDataUrl(it.uploadImageBase64, it.uploadImageName);
        }
        const desc = (it.description || "").trim();
        if (!desc && !imageUrl && !it.productId) continue;
        rows.push({
          quotation_id: q.id,
          product_id: it.productId || null,
          description: desc || productName || category,
          item_image_url: imageUrl,
          quantity: Math.max(1, Number(it.quantity) || 1),
          unit_price: 0,
        });
      }
    } else if (productId || productImage || productName) {
      rows.push({
        quotation_id: q.id,
        product_id: productId,
        description: productName || category,
        item_image_url: productImage,
        quantity: 1,
        unit_price: 0,
      });
    }

    if (rows.length > 0) {
      const { error: itemsErr } = await supabase.from("quotation_items").insert(rows);
      if (itemsErr) console.error("quotation_items insert error", itemsErr);
    }

    return new Response(JSON.stringify({ ok: true, quotation_id: qid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-enquiry-lead error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});