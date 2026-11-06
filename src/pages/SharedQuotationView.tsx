import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Image as ImageIcon, Phone, MapPin, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { firstUrl } from "@/lib/firstUrl";
import { Logo } from "@/components/Logo";
import { COMPANY } from "@/lib/companyInfo";
import quoteHeaderArt from "@/assets/quote-header-art.jpg";

type Item = {
  id: string;
  description: string | null;
  quantity: number | null;
  measurement: string | null;
  item_image_url: string | null;
  measurement_image_url: string | null;
  catalog_text: string | null;
  catalog_image_url: string | null;
  sketch_url: string | null;
  site_photos: string | null;
  unit_price: number | null;
  total_price: number | null;
  fulfillment_route?: string | null;
};

type Quotation = {
  id: string;
  quotation_id: string;
  party_name: string | null;
  party_phone: string | null;
  party_place: string | null;
  status: string | null;
  total_amount: number | null;
  advance_amount: number | null;
  notes: string | null;
  updated_at: string | null;
  commercial_status?: string | null;
  customer_approved_at?: string | null;
};

// Quotations still open for the customer's decision.
const APPROVABLE = new Set(["lead", "quote_preparation", "quote_sent", "follow_up"]);

const CustomerApproval = ({ token, q, onApproved }: { token: string; q: Quotation; onApproved: (at: string) => void }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (q.customer_approved_at) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/70 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">ക്വട്ടേഷൻ അംഗീകരിച്ചു · Quotation approved</p>
          <p className="mt-0.5 text-xs">
            {new Date(q.customer_approved_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} — ഞങ്ങളുടെ ടീം ഉടൻ ബന്ധപ്പെടും. Our team will contact you shortly.
          </p>
        </div>
      </div>
    );
  }
  if (!APPROVABLE.has(q.commercial_status ?? "")) return null;

  const approve = async () => {
    if (busy) return;
    if (!window.confirm("ഈ ക്വട്ടേഷൻ അംഗീകരിക്കട്ടേ? · Approve this quotation?")) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await (supabase as any).rpc("approve_shared_quotation", { p_token: token, p_note: note.trim() || null });
    setBusy(false);
    if (error || !data?.ok) {
      setErr(data?.error === "closed" ? "This quotation is closed. Please contact the showroom." : "Could not record approval. Please try again or call us.");
      return;
    }
    onApproved(data.approved_at ?? new Date().toISOString());
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#E6CDB5] bg-[#FDF6EE] p-4 dark:border-border dark:bg-card">
      <p className="text-sm font-semibold">ഈ ക്വട്ടേഷൻ ഇഷ്ടപ്പെട്ടോ? · Happy with this quotation?</p>
      <p className="text-xs text-muted-foreground">
        Approve ചെയ്താൽ ഞങ്ങളുടെ ടീം അഡ്വാൻസ്, ഡെലിവറി തീയതി എന്നിവ ഉറപ്പിക്കാൻ ബന്ധപ്പെടും. Approving lets our team contact you to fix the advance and delivery date.
      </p>
      <Textarea
        aria-label="Note or changes (optional)"
        className="bg-white text-base dark:bg-background"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="മാറ്റങ്ങൾ / കുറിപ്പ് (optional) · Any changes or note"
      />
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <Button className="h-12 w-full bg-[#5E2D05] text-white hover:bg-[#8A4B1F]" onClick={approve} disabled={busy}>
        {busy ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="mr-2 h-4 w-4" />}
        Approve quotation · അംഗീകരിക്കുന്നു
      </Button>
    </div>
  );
};

const SharedQuotationView = ({ hideAmounts = false }: { hideAmounts?: boolean } = {}) => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{ quotation: Quotation; items: Item[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      const rpcName = hideAmounts ? "get_shared_delivery_note" : "get_shared_quotation";
      const { data: payload, error: rpcErr } = await supabase.rpc(rpcName as any, {
        p_token: token,
      });
      if (rpcErr || !payload) {
        setError(rpcErr?.message ?? "This link is invalid or has been revoked.");
      } else if ((payload as any)?.expired) {
        setExpired(true);
      } else {
        setData(payload as any);
      }
      setLoading(false);
    })();
  }, [token, hideAmounts]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">Link expired</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This delivery note link is only valid for 24 hours after dispatch. Please request a fresh link from the office.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">Quotation not available</p>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "Not found."}</p>
        </div>
      </div>
    );
  }

  const { quotation: q, items } = data;
  const shortCode = q.quotation_id.split(" / ")[0];
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="min-h-[100dvh] bg-[#FDF6EE] dark:bg-background">
      <header className="relative overflow-hidden border-b border-[#E6CDB5] bg-white dark:bg-card">
        <img
          src={quoteHeaderArt}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-[96px] w-[176px] sm:h-[150px] sm:w-[275px]"
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
          <Logo className="h-12 w-auto sm:h-14" />
          <p className="mt-2 max-w-[60%] text-[11px] leading-snug text-[#3B2A1C]/70 sm:text-xs">
            Edapetty, Kalpetta, Wayanad
            <br />
            <a href={`tel:${COMPANY.phone.split("|")[0].trim()}`} className="inline-flex min-h-[44px] items-center text-[#5E2D05]">
              {COMPANY.phone.split("|")[0].trim()}
            </a>
          </p>
        </div>
        <div className="bg-[#5E2D05] px-4 py-2.5 text-white sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-sm font-semibold tracking-[0.18em]">QUOTATION</p>
            <p className="font-mono text-xs">{shortCode}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <section aria-label="Customer" className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-[#8A4B1F]">Prepared for</p>
          <h1 className="text-xl font-semibold text-[#1F140B] dark:text-foreground">{q.party_name ?? "—"}</h1>
          <div className="flex flex-wrap gap-x-4 text-sm text-[#3B2A1C]/75 dark:text-muted-foreground">
            {q.party_phone && (
              <a href={`tel:${q.party_phone}`} className="inline-flex min-h-[44px] items-center gap-1.5 text-[#5E2D05]">
                <Phone aria-hidden="true" className="h-4 w-4" />{q.party_phone}
              </a>
            )}
            {q.party_place && (
              <span className="inline-flex min-h-[44px] items-center gap-1.5">
                <MapPin aria-hidden="true" className="h-4 w-4" />{q.party_place}
              </span>
            )}
          </div>
        </section>

        {q.notes && (
          <p className="whitespace-pre-line border-l-2 border-[#F2A12B] pl-3 text-sm text-[#3B2A1C] dark:text-foreground">{q.notes}</p>
        )}

        <p className="text-xs text-[#3B2A1C]/60 dark:text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"} · Tap an image to enlarge
        </p>

        <div className="space-y-4">
          {items.map((it, idx) => {
            const sitePics = (it.site_photos ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            const main = firstUrl(it.item_image_url);
            return (
              <article key={it.id} className="overflow-hidden rounded-2xl border border-[#E6CDB5] bg-white dark:border-border dark:bg-card">
                <div className="flex items-start justify-between gap-3 px-4 pt-4">
                  <h2 className="text-base font-semibold leading-snug text-[#1F140B] dark:text-foreground">
                    <span className="mr-1.5 text-[#8A4B1F]">{idx + 1}.</span>{it.description}
                  </h2>
                  <span className="shrink-0 rounded-full bg-[#FBEFE4] px-3 py-1 text-xs font-semibold text-[#5E2D05]">
                    Qty {it.quantity ?? 1}
                  </span>
                </div>

                <div className="space-y-4 p-4">
                  {main ? (
                    <button type="button" aria-label="Enlarge item image" onClick={() => setZoom(main)} className="block w-full overflow-hidden rounded-xl bg-[#FDF6EE]">
                      <img src={main} alt={it.description ?? ""} className="h-auto max-h-[420px] w-full object-contain" loading="lazy" />
                    </button>
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-[#FDF6EE]">
                      <ImageIcon aria-hidden="true" className="h-8 w-8 text-[#8A4B1F]/40" />
                    </div>
                  )}

                  {(it.measurement || it.measurement_image_url) && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[#8A4B1F]">Measurement</p>
                      {it.measurement && <p className="mt-1 whitespace-pre-line text-sm font-medium text-[#1F140B] dark:text-foreground">{it.measurement}</p>}
                      {it.measurement_image_url && (
                        <button type="button" aria-label="Enlarge measurement image" onClick={() => setZoom(it.measurement_image_url!)} className="mt-2 block w-full overflow-hidden rounded-xl bg-white">
                          <img src={it.measurement_image_url} alt="Measurement" className="h-auto w-full object-contain" loading="lazy" />
                        </button>
                      )}
                    </div>
                  )}

                  {it.sketch_url && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[#8A4B1F]">Sketch</p>
                      <button type="button" aria-label="Enlarge sketch" onClick={() => setZoom(it.sketch_url!)} className="mt-2 block w-full overflow-hidden rounded-xl bg-white">
                        <img src={it.sketch_url} alt="Sketch" className="h-auto w-full object-contain" loading="lazy" />
                      </button>
                    </div>
                  )}

                  {(it.catalog_text || it.catalog_image_url) && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[#8A4B1F]">Catalog reference</p>
                      {it.catalog_text && <p className="mt-1 whitespace-pre-line text-sm text-[#3B2A1C] dark:text-foreground">{it.catalog_text}</p>}
                      {it.catalog_image_url && (
                        <button type="button" aria-label="Enlarge catalog image" onClick={() => setZoom(it.catalog_image_url!)} className="mt-2 block w-full overflow-hidden rounded-xl bg-white">
                          <img src={it.catalog_image_url} alt="Catalog" className="h-auto w-full object-contain" loading="lazy" />
                        </button>
                      )}
                    </div>
                  )}

                  {sitePics.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[#8A4B1F]">Site photos · {sitePics.length}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {sitePics.map((u, k) => (
                          <button key={k} type="button" aria-label={`Enlarge site photo ${k + 1}`} onClick={() => setZoom(u)} className="aspect-square overflow-hidden rounded-lg bg-[#FDF6EE]">
                            <img src={u} alt={`Site ${k + 1}`} loading="lazy" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {!hideAmounts && (it.unit_price != null || it.total_price != null) && (
                  <div className="flex items-center justify-between border-t border-[#E6CDB5]/70 bg-[#FDF6EE] px-4 py-3 text-sm dark:border-border dark:bg-muted/30">
                    <span className="text-[#3B2A1C]/70 dark:text-muted-foreground">{it.unit_price != null ? `${inr(it.unit_price)} each` : "Price"}</span>
                    {it.total_price != null && <span className="font-semibold text-[#5E2D05] dark:text-foreground">{inr(it.total_price)}</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {!hideAmounts && (q.total_amount != null || (q.advance_amount != null && q.advance_amount > 0)) && (
          <section aria-label="Totals" className="overflow-hidden rounded-2xl border border-[#E6CDB5] bg-white dark:border-border dark:bg-card">
            {q.total_amount != null && (
              <div className="flex items-center justify-between bg-[#5E2D05] px-4 py-3.5 text-white">
                <span className="text-sm">Total Amount</span>
                <span className="text-xl font-bold">{inr(q.total_amount)}</span>
              </div>
            )}
            {q.advance_amount != null && q.advance_amount > 0 && (
              <div className="flex items-center justify-between px-4 py-3 text-sm text-[#3B2A1C] dark:text-foreground">
                <span>Advance paid</span>
                <span className="font-medium">{inr(q.advance_amount)}</span>
              </div>
            )}
          </section>
        )}

        {!hideAmounts && token && (
          <CustomerApproval
            token={token}
            q={q}
            onApproved={(at) => setData((d) => (d ? { ...d, quotation: { ...d.quotation, customer_approved_at: at } } : d))}
          />
        )}

        <footer className="pb-8 pt-2 text-center">
          <p className="font-script text-lg text-[#5E2D05]" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}>Thank You</p>
          <p className="mt-1 text-[11px] text-[#3B2A1C]/60 dark:text-muted-foreground">
            Live document · Updated {q.updated_at ? new Date(q.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
          </p>
        </footer>
      </main>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Image preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Enlarged" className="max-h-full max-w-full object-contain" style={{ touchAction: "pinch-zoom" }} onClick={(e) => e.stopPropagation()} />
          <button type="button" aria-label="Close preview" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black" onClick={() => setZoom(null)}>
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SharedQuotationView;