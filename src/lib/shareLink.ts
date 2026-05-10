// Build & share live, mobile-optimized links to quotations / work orders.
//
// These links open a public, token-gated page (`/s/q/:token` or `/s/j/:token`)
// that renders the latest version of the document directly from the database
// — unlike static JPG/PDF exports — so workers always see the most current
// measurements, sketches and notes. Pages use plain HTML + native pinch-zoom
// so they stay sharp at any zoom level.

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { openWhatsAppApp } from "@/lib/whatsapp";

export type ShareKind = "quotation" | "job";

const PATH = { quotation: "/s/q", job: "/s/j" } as const;

/** Ensure a row has a `share_token` and return the public URL for it. */
export async function ensureShareUrl(kind: ShareKind, rowId: string): Promise<string | null> {
  const table = kind === "quotation" ? "quotations" : "job_work_orders";
  // Read-or-mint: token already has a default value via the DB, so SELECT is enough.
  const { data, error } = await supabase
    .from(table)
    .select("share_token")
    .eq("id", rowId)
    .maybeSingle();
  if (error || !data?.share_token) {
    toast({
      title: "Couldn't generate link",
      description: error?.message ?? "Missing share token",
      variant: "destructive",
    });
    return null;
  }
  return `${window.location.origin}${PATH[kind]}/${data.share_token}`;
}

/** Copy the live share URL to the clipboard and offer a WhatsApp shortcut. */
export async function shareLiveLink(opts: {
  kind: ShareKind;
  rowId: string;
  /** Pre-filled WhatsApp message accompanying the link. */
  message: string;
  /** Phone number for direct WhatsApp open (optional). */
  phone?: string | null;
  /** When true, immediately open WhatsApp instead of just copying. */
  openWhatsApp?: boolean;
}) {
  const url = await ensureShareUrl(opts.kind, opts.rowId);
  if (!url) return;

  const fullMessage = `${opts.message}\n${url}`;

  // Always copy so user has it on the clipboard for any other channel.
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* clipboard might be unavailable in iframes — ignore */
  }

  if (opts.openWhatsApp) {
    openWhatsAppApp(opts.phone ?? "", fullMessage);
    return;
  }

  // Native share sheet first (mobile), fallback to WhatsApp web.
  if (typeof navigator !== "undefined" && typeof (navigator as any).share === "function") {
    try {
      await (navigator as any).share({ title: "Live document link", text: opts.message, url });
      toast({ title: "Link shared", description: "Live mobile link sent." });
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      // fall through
    }
  }

  toast({
    title: "Link copied",
    description: "Live mobile link copied to clipboard. Paste it anywhere — it always shows the latest version.",
  });
}