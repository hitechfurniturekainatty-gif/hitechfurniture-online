// Google Gemini, called directly with our own GEMINI_API_KEY (Supabase secret).
// Uses Gemini's OpenAI-compatible endpoint, so requests and responses keep the
// familiar { messages } / { choices[0].message.content } shape.
// Replaced the Lovable AI Gateway on 2026-11-24; Lovable is no longer needed.

export const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const GEMINI_TEXT_MODEL = "gemini-2.5-flash";

export const geminiKey = () => Deno.env.get("GEMINI_API_KEY") ?? null;

type ChatBody = {
  messages: unknown[];
  response_format?: { type: "json_object" };
  temperature?: number;
  model?: string;
};

/** POST a chat completion to Gemini. Returns the raw Response (caller checks ok/status). */
export function geminiChat(body: ChatBody): Promise<Response> {
  const key = geminiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return fetch(GEMINI_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GEMINI_TEXT_MODEL, ...body }),
  });
}

/** Gemini accepts inline images only; turn an http(s) image URL into a data URL. */
export async function toDataUrl(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return url;
  const r = await fetch(url, { headers: { Accept: "image/*" }, redirect: "follow" });
  const ct = r.headers.get("content-type") ?? "";
  if (!r.ok || !ct.startsWith("image/")) throw new Error(`Could not load the image (${r.status})`);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${ct.split(";")[0]};base64,${btoa(bin)}`;
}

/** A user-facing message for a failed Gemini call. */
export async function geminiError(r: Response): Promise<{ status: number; error: string }> {
  const txt = await r.text().catch(() => "");
  if (r.status === 429) return { status: 429, error: "AI is busy or the daily Gemini quota is used up. Try again shortly." };
  if (r.status === 401 || r.status === 403) return { status: 500, error: "Gemini API key was rejected. Check GEMINI_API_KEY in Supabase secrets." };
  return { status: 500, error: `AI error: ${txt.slice(0, 300)}` };
}
