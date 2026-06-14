// Public endpoint that turns a website enquiry into a draft quotation (lead).
// No auth required — uses the service role to bypass RLS.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

    if (productId || productImage || productName) {
      await supabase.from("quotation_items").insert({
        quotation_id: q.id,
        product_id: productId,
        description: productName || category,
        item_image_url: productImage,
        quantity: 1,
        unit_price: 0,
      });
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