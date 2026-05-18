import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Phone, MessageCircle, Printer, MapPin, Calendar } from "lucide-react";
import { COMPANY } from "@/lib/companyInfo";
import { firstUrl } from "@/lib/firstUrl";

type Item = {
  id: string;
  description: string;
  quantity: number;
  measurement: string | null;
  catalog_text: string | null;
  item_image_url: string | null;
  display_order: number;
};

type Quote = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  party_address: string | null;
  delivery_place: string | null;
  expected_delivery_date: string | null;
  notes: string | null;
  status: string;
};

/**
 * Delivery-team safe view of a quotation:
 *   - Customer name, address, phone, delivery place
 *   - Full item list (description, qty, measurement, catalog code, photo)
 *   - NO unit price, NO GST, NO total, NO discount, NO advance
 *
 * Mobile-first plain HTML so pinch-zoom stays crisp on any device.
 * Print-friendly via the browser's native print dialog (Ctrl/Cmd+P or
 * the in-page Print button) — produces a clean delivery slip.
 */
const DeliveryNote = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isOfficeStaff, isDelivery, loading: authLoading } = useAuth();
  const [q, setQ] = useState<Quote | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (!isOfficeStaff && !isDelivery) {
      toast({ title: "Access denied", description: "Delivery team or office only.", variant: "destructive" });
      navigate("/", { replace: true });
      return;
    }
    if (!id) return;
    void load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isOfficeStaff, isDelivery, id]);

  const load = async (quoteId: string) => {
    setLoading(true);
    const [{ data: quote, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
      supabase
        .from("quotations")
        .select("id, quotation_id, party_name, party_place, party_phone, party_address, delivery_place, expected_delivery_date, notes, status")
        .eq("id", quoteId)
        .maybeSingle(),
      supabase
        .from("quotation_items")
        .select("id, description, quantity, measurement, catalog_text, item_image_url, display_order")
        .eq("quotation_id", quoteId)
        .order("display_order", { ascending: true }),
    ]);
    if (e1 || !quote) {
      toast({ title: "Not found", variant: "destructive" });
      navigate(-1);
      return;
    }
    if (e2) toast({ title: "Items load failed", description: e2.message, variant: "destructive" });
    setQ(quote as Quote);
    setItems((lines ?? []) as Item[]);
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!q) return null;

  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const phoneDigits = (q.party_phone ?? "").replace(/\D/g, "");

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Sticky action bar — hidden in print */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-mono font-semibold">{q.quotation_id}</p>
            <p className="truncate text-[11px] text-muted-foreground">Delivery slip — no prices</p>
          </div>
          {phoneDigits && (
            <>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <a href={`tel:${q.party_phone}`}><Phone className="h-4 w-4" /></a>
              </Button>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                </a>
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => window.print()} className="shrink-0">
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Document */}
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm print:border-0 print:shadow-none">
          {/* Letterhead */}
          <div className="border-b border-border bg-primary px-4 py-4 text-primary-foreground print:bg-white print:text-foreground">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h1 className="font-display text-xl sm:text-2xl">{COMPANY.name}</h1>
                <p className="text-xs opacity-90">{COMPANY.address} · {COMPANY.phone}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] uppercase tracking-wider opacity-80">Delivery Slip</p>
                <p className="font-mono text-sm font-bold">{q.quotation_id}</p>
              </div>
            </div>
          </div>

          {/* Customer block */}
          <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deliver to</p>
              <p className="mt-1 font-display text-lg">{q.party_name}</p>
              {q.party_address && (
                <p className="mt-1 flex items-start gap-1 text-sm text-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {q.party_address}
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {q.delivery_place || q.party_place}
              </p>
              {q.party_phone && (
                <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={`tel:${q.party_phone}`} className="hover:underline">{q.party_phone}</a>
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery date
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-display text-lg">
                <Calendar className="h-4 w-4 text-primary" />
                {q.expected_delivery_date
                  ? new Date(q.expected_delivery_date).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })
                  : "—"}
              </p>
              <div className="mt-2 sm:flex sm:justify-end">
                <Badge variant="secondary" className="capitalize">{q.status}</Badge>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base">Items to deliver</h2>
              <span className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "line" : "lines"} · Total qty {totalQty}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No items on this order.</p>
            ) : (
              <ol className="space-y-3">
                {items.map((it, idx) => (
                  <li
                    key={it.id}
                    className="overflow-hidden rounded-md border border-border bg-background"
                  >
                    <div className="flex items-stretch gap-3 p-3">
                      <div className="shrink-0">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {idx + 1}
                        </span>
                      </div>
                      {firstUrl(it.item_image_url) && (
                        <button
                          type="button"
                          onClick={() => setZoomImage(firstUrl(it.item_image_url))}
                          className="h-20 w-20 shrink-0 overflow-hidden rounded border border-border bg-muted print:h-16 print:w-16"
                        >
                          <img
                            src={firstUrl(it.item_image_url)!}
                            alt={it.description}
                            loading="lazy"
                            className="h-full w-full object-contain p-1"
                          />
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{it.description}</p>
                        {it.catalog_text && (
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {it.catalog_text}
                          </p>
                        )}
                        {it.measurement && (
                          <p className="mt-1 whitespace-pre-line rounded bg-muted/50 px-2 py-1 text-xs">
                            <span className="font-semibold">Size:</span> {it.measurement}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] uppercase text-muted-foreground">Qty</p>
                        <p className="font-display text-2xl font-semibold tabular-nums">
                          {Number(it.quantity) || 0}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {q.notes && (
              <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-line">{q.notes}</p>
              </div>
            )}
          </div>

          {/* Signature block — appears in print */}
          <div className="border-t border-border px-4 py-6 print:py-10">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="h-12 border-b border-border" />
                <p className="mt-1 text-[11px] text-muted-foreground">Delivered by (Driver)</p>
              </div>
              <div>
                <div className="h-12 border-b border-border" />
                <p className="mt-1 text-[11px] text-muted-foreground">Received by (Customer signature & date)</p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-muted-foreground print:hidden">
          This is a delivery slip. Pricing details are intentionally omitted.
        </p>
      </div>

      {/* Image zoom overlay */}
      {zoomImage && (
        <button
          type="button"
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4 print:hidden"
          aria-label="Close image"
        >
          <img
            src={zoomImage}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </button>
      )}

      {/* Print-only tweaks */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          html, body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
};

export default DeliveryNote;