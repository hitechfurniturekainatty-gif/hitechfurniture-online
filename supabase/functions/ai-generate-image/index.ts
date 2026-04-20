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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY)
      return json({ error: "AI not configured" }, 500);

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
    const mode: "generate" | "edit" = body.mode === "edit" ? "edit" : "generate";
    const prompt: string = (body.prompt ?? "").toString().trim();
    const itemName: string = (body.item_name ?? "").toString().trim();
    const sourceImageUrl: string | undefined = body.source_image_url;
    // Default to Nano Banana (gemini-2.5-flash-image) — works on Google's free
    // tier. Nano Banana 2 (gemini-3.1-flash-image-preview) is paid-only and
    // returns RESOURCE_EXHAUSTED on free keys. Caller can override.
    const model: string = body.model ?? "google/gemini-2.5-flash-image";
    if (!prompt && !itemName) return json({ error: "Item description required" }, 400);

    const finalPrompt = mode === "generate"
      ? [
          "Create a photorealistic catalog product image that matches the described item exactly.",
          itemName ? `PRODUCT DESCRIPTION (source of truth): ${itemName}` : "",
          prompt ? `IMAGE / STYLING INSTRUCTIONS: ${prompt}` : "",
          "Do not change the product type, shape, size, seating capacity, color, material, proportions, or core features from the description.",
          "If any detail is missing, keep the design simple and realistic instead of inventing major new features.",
          "Show one main product only, fully visible, centered, sharp, photorealistic, and suitable for a sales catalog.",
          "Do not add text, logos, watermarks, people, or unrelated extra objects unless explicitly requested.",
        ].filter(Boolean).join("\n\n")
      : [
          prompt,
          itemName ? `Preserve these product details while editing: ${itemName}` : "",
        ].filter(Boolean).join("\n\n");

    // Build messages: edit mode if source image provided.
    // For remote http(s) URLs we fetch + inline as data URL ourselves so that:
    //  1. Sites that 403 the AI gateway (retailers etc.) still work via a
    //     browser-like User-Agent.
    //  2. We can validate the response is actually an image (not an HTML page).
    let inlineImageUrl: string | undefined = sourceImageUrl;
    if (sourceImageUrl && /^https?:\/\//i.test(sourceImageUrl)) {
      try {
        const imgResp = await fetch(sourceImageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            Accept: "image/*,*/*;q=0.8",
          },
          redirect: "follow",
        });
        if (!imgResp.ok) {
          return json(
            {
              error: `Could not fetch source image (${imgResp.status}). The site may block hot-linking — please download the image and use "Attach image" instead.`,
            },
            400,
          );
        }
        const ct = imgResp.headers.get("content-type") ?? "";
        if (!ct.startsWith("image/")) {
          return json(
            {
              error:
                "That URL is not an image (looks like a webpage). Right-click the photo on the source site, copy the image address, and paste it — or use \"Attach image\".",
            },
            400,
          );
        }
        const buf = new Uint8Array(await imgResp.arrayBuffer());
        // Inline as data URL — Gemini accepts this directly.
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        inlineImageUrl = `data:${ct};base64,${btoa(bin)}`;
      } catch (e) {
        console.error("Source image fetch failed", e);
        return json(
          { error: "Could not download the source image URL. Try attaching the file instead." },
          400,
        );
      }
    }

    const userContent: unknown = inlineImageUrl
      ? [
          { type: "text", text: finalPrompt },
          { type: "image_url", image_url: { url: inlineImageUrl } },
        ]
      : finalPrompt;

    const systemPrompt =
      "You generate high-accuracy product images for catalogs. Follow the provided product description exactly and prioritize item identity over style. Never substitute a different item category, silhouette, material, color, or feature set.";

    const callGateway = () =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          modalities: ["image", "text"],
        }),
      });

    const callGemini = () => {
      const geminiModel = model.startsWith("google/")
        ? model.slice("google/".length)
        : "gemini-2.5-flash-image";
      const parts: unknown[] = [{ text: `${systemPrompt}\n\n${finalPrompt}` }];
      if (inlineImageUrl?.startsWith("data:")) {
        const m = inlineImageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
      }
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        },
      );
    };

    let aiResp: Response;
    let usingDirectGemini = false;
    let fellBackFromGeminiQuota = false;

    if (GEMINI_API_KEY) {
      usingDirectGemini = true;
      aiResp = await callGemini();

      if (!aiResp.ok && LOVABLE_API_KEY) {
        const txt = await aiResp.clone().text().catch(() => "");
        let detail = "";
        try {
          const parsed = JSON.parse(txt);
          detail = parsed?.error?.message ?? parsed?.error?.status ?? "";
        } catch { /* ignore */ }

        const geminiQuotaBlocked =
          aiResp.status === 429 && /quota|RESOURCE_EXHAUSTED|free_tier/i.test(detail);

        if (geminiQuotaBlocked) {
          fellBackFromGeminiQuota = true;
          usingDirectGemini = false;
          aiResp = await callGateway();
        }
      }
    } else {
      aiResp = await callGateway();
    }

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      // Try to surface the model's actual error so the user knows what to fix.
      let detail = "";
      try {
        const parsed = JSON.parse(txt);
        detail = parsed?.error?.message ?? parsed?.error?.status ?? "";
      } catch { /* not JSON */ }
      if (aiResp.status === 429) {
        const isQuota = /quota|RESOURCE_EXHAUSTED|free_tier/i.test(detail);
        return json(
          {
            error: isQuota
              ? fellBackFromGeminiQuota
                ? "Your Gemini key has no image quota, and the backup AI service is currently rate limited. Please wait a moment and try again."
                : "Your Google Gemini API key has no image generation quota. Enable billing on your Google AI Studio project to use your own account for image generation."
              : "Rate limited. Please try again in a moment.",
          },
          429,
        );
      }
      if (aiResp.status === 402)
        return json({
          error: fellBackFromGeminiQuota
            ? "Your Gemini key has no image quota, and the backup AI credits are exhausted. Enable billing on your Google AI Studio project or add workspace AI credits."
            : "AI credits exhausted. Add funds in Lovable workspace settings.",
        }, 402);
      return json(
        { error: detail ? `AI generation failed: ${detail}` : "AI generation failed" },
        500,
      );
    }

    const aiData = await aiResp.json();
    let dataUrl: string | undefined;
    if (usingDirectGemini) {
      const partsOut = aiData?.candidates?.[0]?.content?.parts ?? [];
      for (const p of partsOut) {
        const inline = p?.inline_data ?? p?.inlineData;
        if (inline?.data) {
          const mt = inline.mime_type ?? inline.mimeType ?? "image/png";
          dataUrl = `data:${mt};base64,${inline.data}`;
          break;
        }
      }
    } else {
      dataUrl = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    }
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
