// Public 3-step enquiry router. Routes by `type` to the right table.
// - new_purchase / custom_design / delivery_installation / general_inquiry
//     → quotations (lead) with `enquiry_type` set
// - complaint_replacement → customer_complaints
// - service_repair        → customer_services
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EnquiryType =
  | "new_purchase"
  | "custom_design"
  | "delivery_installation"
  | "general_inquiry"
  | "complaint_replacement"
  | "service_repair";

const LEAD_TYPES: EnquiryType[] = [
  "new_purchase",
  "custom_design",
  "delivery_installation",
  "general_inquiry",
];

const isPhone = (s: string) => /^[0-9+\-\s()]{7,20}$/.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const type = String(body.type || "").trim() as EnquiryType;
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const place = String(body.place || "").trim();
    const message = String(body.message || "").trim();
    const billNumber = String(body.billNumber || "").trim();
    const itemDescription = String(body.itemDescription || "").trim();
    const workNeeded = String(body.workNeeded || "").trim();
    const photoBase64: string | null = body.photoBase64 || null;
    const photoName: string | null = body.photoName || null;

    if (!type || !name || !phone || !place) {
      return new Response(
        JSON.stringify({ error: "type, name, phone, place are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!isPhone(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Complaint ────────────────────────────────────────────────────────────
    if (type === "complaint_replacement") {
      const { data: code, error: codeErr } = await supabase.rpc("next_complaint_id");
      if (codeErr) throw codeErr;

      let photoUrl: string | null = null;
      if (photoBase64) {
        photoUrl = await uploadPhoto(supabase, photoBase64, photoName);
      }

      const { error } = await supabase.from("customer_complaints").insert({
        complaint_code: code,
        customer_name: name,
        customer_phone: phone,
        customer_place: place,
        original_quotation_code: billNumber || null,
        issue_description: message || "(no description provided)",
        photos: photoUrl,
        status: "pending",
      });
      if (error) throw error;
      return ok({ ok: true, type, code });
    }

    // ── Service ──────────────────────────────────────────────────────────────
    if (type === "service_repair") {
      if (!itemDescription) {
        return bad("itemDescription is required for service requests");
      }
      const { data: code, error: codeErr } = await supabase.rpc("next_service_id");
      if (codeErr) throw codeErr;

      const { error } = await supabase.from("customer_services").insert({
        service_code: code,
        customer_name: name,
        customer_phone: phone,
        customer_place: place,
        item_description: itemDescription,
        work_needed: workNeeded || null,
        status: "pending",
      });
      if (error) throw error;
      return ok({ ok: true, type, code });
    }

    // ── Lead-style: quotations ───────────────────────────────────────────────
    if (!LEAD_TYPES.includes(type)) {
      return bad("Unknown enquiry type");
    }

    const { data: qid, error: idErr } = await supabase.rpc("next_quotation_id", {
      _party: name,
      _place: place,
    });
    if (idErr) throw idErr;

    const labelMap: Record<string, string> = {
      new_purchase: "New Purchase",
      custom_design: "Custom Design",
      delivery_installation: "Delivery & Installation",
      general_inquiry: "General Inquiry",
    };
    const notes = `Website enquiry — ${labelMap[type]}\n\n${message || "(no message)"}`;

    const { error: qErr } = await supabase.from("quotations").insert({
      quotation_id: qid,
      party_name: name,
      party_place: place,
      party_phone: phone,
      notes,
      salesperson_name: "Website Enquiry",
      lead_type: "lead",
      enquiry_type: type,
      status: "drafted",
      pipeline_stage: 1,
    });
    if (qErr) throw qErr;

    return ok({ ok: true, type, code: qid });
  } catch (e) {
    console.error("create-enquiry error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function ok(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function bad(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function uploadPhoto(
  supabase: ReturnType<typeof createClient>,
  dataUrl: string,
  hintName: string | null,
): Promise<string | null> {
  try {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return null;
    const mime = m[1];
    const b64 = m[2];
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = (mime.split("/")[1] || "jpg").split("+")[0];
    const safe = (hintName || "photo").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
    const path = `complaints/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}.${ext}`;
    const { error } = await supabase.storage
      .from("quotation-images")
      .upload(path, bin, { contentType: mime, upsert: false });
    if (error) {
      console.error("complaint photo upload failed", error);
      return null;
    }
    return supabase.storage.from("quotation-images").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error("uploadPhoto error", e);
    return null;
  }
}