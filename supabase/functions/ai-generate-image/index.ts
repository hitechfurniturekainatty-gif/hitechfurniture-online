// Edge function: generates or edits an image using Lovable AI Gateway (Gemini Nano Banana),
// then uploads the resulting PNG to the product-images bucket and returns the public URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    // Verify caller is staff/admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isStaff = (roles ?? []).some((r) =>
      ["admin", "staff"].includes(r.role as string),
    );
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const prompt: string = (body.prompt ?? "").toString().trim();
    const sourceImageUrl: string | undefined = body.source_image_url;
    // Default to Nano Banana 2 (fast + pro-quality). Caller can override.
    const model: string = body.model ?? "google/gemini-3.1-flash-image-preview";
    if (!prompt) return json({ error: "Prompt required" }, 400);

    // Build messages: edit mode if source image provided
    const userContent: unknown = sourceImageUrl
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: sourceImageUrl } },
        ]
      : prompt;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      if (aiResp.status === 429)
        return json({ error: "Rate limited. Please try again in a moment." }, 429);
      if (aiResp.status === 402)
        return json({
          error: "AI credits exhausted. Add funds in Lovable workspace settings.",
        }, 402);
      return json({ error: "AI generation failed" }, 500);
    }

    const aiData = await aiResp.json();
    const dataUrl: string | undefined =
      aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:image/")) {
      console.error("No image in response", JSON.stringify(aiData).slice(0, 500));
      return json({ error: "Model did not return an image" }, 500);
    }

    // Decode data URL → bytes
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.match(/data:([^;]+)/)?.[1] ?? "image/png";
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    const path = `ai-generated/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("product-images")
      .upload(path, bin, {
        contentType: mime,
        upsert: false,
        // 1-year immutable browser cache — paths are UUID-based.
        cacheControl: "31536000, immutable",
      });
    if (upErr) {
      console.error("Storage upload error", upErr);
      return json({ error: "Failed to save image" }, 500);
    }
    const { data: pub } = admin.storage.from("product-images").getPublicUrl(path);
    return json({ url: pub.publicUrl, path });
  } catch (e) {
    console.error("ai-generate-image error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
