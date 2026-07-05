import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Clock, User, RefreshCw } from "lucide-react";
import { formatINR } from "@/lib/brand";
import { toTitleCase } from "@/lib/textCase";

type MainCat = { id: string; name: string };
type SubCat = { id: string; main_category_id: string; name: string };

type PendingItem = {
  id: string;
  source: "products" | "pending_catalog_items";
  product_name: string;
  primary_image_url: string | null;
  mrp: number | null;
  offer_price: number | null;
  cost_price: number | null;
  creation_method: string | null;
  submitted_by: string | null;
  created_at: string;
  main_category_id: string | null;
  sub_category_id: string | null;
  review_status: string;
  notes: string | null;
};

const METHOD_LABEL: Record<string, string> = {
  direct_creation: "Direct Creation",
  direct_upload: "Bulk Upload",
  automation_flow: "Automation",
};

const AdminProductApproval = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);

  // Per-item category selection state: { [itemId]: { main: string, sub: string } }
  const [catSelection, setCatSelection] = useState<Record<string, { main: string; sub: string }>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<PendingItem | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: prods }, { data: pending }] = await Promise.all([
      supabase
        .from("products")
        .select("id, product_name, primary_image_url, mrp, offer_price, cost_price, creation_method, submitted_by, created_at, main_category_id, sub_category_id, review_status, notes")
        .eq("review_status", "pending_supervision")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("pending_catalog_items")
        .select("id, product_name, primary_image_url, mrp, offer_price, cost_price, creation_method, submitted_by, created_at, main_category_id, sub_category_id, review_status, notes")
        .order("created_at", { ascending: false }),
    ]);

    const mapped: PendingItem[] = [
      ...((prods ?? []) as any[]).map((r) => ({ ...r, source: "products" as const })),
      ...((pending ?? []) as any[]).map((r) => ({ ...r, source: "pending_catalog_items" as const })),
    ];
    setItems(mapped);

    // Pre-fill category selections from whatever is already set on each item
    const init: Record<string, { main: string; sub: string }> = {};
    mapped.forEach((item) => {
      init[item.id] = { main: item.main_category_id ?? "", sub: item.sub_category_id ?? "" };
    });
    setCatSelection((prev) => ({ ...init, ...prev }));
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;
    load();
    supabase.from("main_categories").select("id, name").order("display_order").then(({ data }) => setMainCats((data ?? []) as MainCat[]));
    supabase.from("sub_categories").select("id, main_category_id, name").order("display_order").then(({ data }) => setSubCats((data ?? []) as SubCat[]));
  }, [isAdmin, authLoading]);

  const setCat = (id: string, field: "main" | "sub", value: string) => {
    setCatSelection((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, ...(field === "main" ? { sub: "" } : {}) },
    }));
  };

  const canApprove = (item: PendingItem) => {
    const sel = catSelection[item.id];
    return !!sel?.main && !!sel?.sub;
  };

  const approve = async (item: PendingItem) => {
    const sel = catSelection[item.id];
    if (!canApprove(item)) return;
    setProcessing((p) => ({ ...p, [item.id]: true }));

    const { data: { user } } = await supabase.auth.getUser();
    const reviewedBy = user?.id ?? null;
    const reviewedAt = new Date().toISOString();

    try {
      if (item.source === "products") {
        const { error } = await supabase
          .from("products")
          .update({
            review_status: "approved",
            is_published: true,
            main_category_id: sel.main,
            sub_category_id: sel.sub,
            reviewed_by: reviewedBy,
            reviewed_at: reviewedAt,
          })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        // pending_catalog_items → insert into products
        const { data: srcRow } = await (supabase as any)
          .from("pending_catalog_items")
          .select("*")
          .eq("id", item.id)
          .single();
        if (!srcRow) throw new Error("Source row not found");
        const { id: _ignore, ...rest } = srcRow;
        const { error: insErr } = await supabase.from("products").insert({
          ...rest,
          main_category_id: sel.main,
          sub_category_id: sel.sub,
          review_status: "approved",
          is_published: true,
          reviewed_by: reviewedBy,
          reviewed_at: reviewedAt,
        });
        if (insErr) throw insErr;
        // Mark pending item resolved
        await (supabase as any)
          .from("pending_catalog_items")
          .update({ review_status: "approved" })
          .eq("id", item.id);
      }
      toast({ title: `"${item.product_name}" approved and published` });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e: any) {
      toast({ title: "Approval failed", description: e?.message, variant: "destructive" });
    } finally {
      setProcessing((p) => ({ ...p, [item.id]: false }));
    }
  };

  const openReject = (item: PendingItem) => {
    setRejectTarget(item);
    setRejectNote("");
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      const table = rejectTarget.source === "products" ? "products" : "pending_catalog_items";
      const { error } = await (supabase as any)
        .from(table)
        .update({
          review_status: "rejected",
          is_published: false,
          notes: rejectNote.trim() || rejectTarget.notes || null,
        })
        .eq("id", rejectTarget.id);
      if (error) throw error;
      toast({ title: `"${rejectTarget.product_name}" rejected` });
      setItems((prev) => prev.filter((x) => x.id !== rejectTarget.id));
      setRejectTarget(null);
    } catch (e: any) {
      toast({ title: "Reject failed", description: e?.message, variant: "destructive" });
    } finally {
      setRejecting(false);
    }
  };

  const groupedByMethod = useMemo(() => {
    const g: Record<string, PendingItem[]> = {};
    items.forEach((item) => {
      const key = item.creation_method ?? "unknown";
      (g[key] ||= []).push(item);
    });
    return g;
  }, [items]);

  if (!authLoading && !isAdmin) {
    return (
      <AdminShell>
        <div className="rounded-xl border bg-card p-6 text-center">
          <h1 className="font-display text-xl">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">Supervisor approval is restricted to admins.</p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Supervisor Approval</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""} pending — select Main &amp; Sub category before approving.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card p-16 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-green-500" />
          <p className="font-medium">All caught up — no pending items.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByMethod).map(([method, methodItems]) => (
            <section key={method}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {METHOD_LABEL[method] ?? method}
                </h2>
                <Badge variant="secondary">{methodItems.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {methodItems.map((item) => {
                  const sel = catSelection[item.id] ?? { main: "", sub: "" };
                  const subsForItem = subCats.filter((s) => s.main_category_id === sel.main);
                  const busy = processing[item.id];
                  const ready = canApprove(item);
                  return (
                    <Card key={item.id} className="overflow-hidden">
                      <div className="relative aspect-video bg-muted">
                        {item.primary_image_url ? (
                          <img src={item.primary_image_url} alt={item.product_name} className="h-full w-full object-contain p-3" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
                        )}
                        <Badge className="absolute left-2 top-2 text-[10px]" variant="outline">
                          {METHOD_LABEL[item.creation_method ?? ""] ?? item.creation_method}
                        </Badge>
                      </div>
                      <CardContent className="space-y-3 p-4">
                        <div>
                          <p className="font-semibold leading-snug">{toTitleCase(item.product_name)}</p>
                          <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                            {item.mrp != null && <span>MRP {formatINR(item.mrp)}</span>}
                            {item.offer_price != null && <span>· Offer {formatINR(item.offer_price)}</span>}
                            {item.cost_price != null && <span>· Cost {formatINR(item.cost_price)}</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{item.submitted_by ? item.submitted_by.slice(0, 8) + "…" : "unknown"}</span>
                            <Clock className="ml-1 h-3 w-3" />
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Category selectors — must both be filled before Approve enables */}
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Main category *</Label>
                            <SearchableSelect
                              value={sel.main || ""}
                              onChange={(v) => setCat(item.id, "main", v)}
                              options={mainCats.map((c) => ({ value: c.id, label: toTitleCase(c.name) }))}
                              placeholder="Choose main category…"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Sub-category *</Label>
                            <SearchableSelect
                              value={sel.sub || ""}
                              onChange={(v) => setCat(item.id, "sub", v)}
                              options={subsForItem.map((s) => ({ value: s.id, label: toTitleCase(s.name) }))}
                              placeholder={sel.main ? "Choose sub-category…" : "Pick main first"}
                              disabled={!sel.main}
                            />
                          </div>
                        </div>

                        {!ready && (
                          <p className="text-[11px] text-amber-600">
                            Select both Main &amp; Sub category to enable Approve.
                          </p>
                        )}

                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 gap-1.5"
                            disabled={!ready || busy}
                            onClick={() => approve(item)}
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1.5 text-destructive"
                            disabled={busy}
                            onClick={() => openReject(item)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject "{rejectTarget?.product_name}"?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Rejection note (optional)</Label>
            <Textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection…"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={rejecting} className="gap-1.5">
              {rejecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminProductApproval;
