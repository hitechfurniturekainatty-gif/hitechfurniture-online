import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeQuotations } from "@/hooks/useRealtimeQuotations";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, FileText, ArrowRight, Trash2, Search, Filter, User, ShoppingCart } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatINR } from "@/lib/brand";
import { statusBadgeVariant, statusLabel } from "./AdminQuotationEditor";
import { ContactPicker } from "@/components/admin/ContactPicker";
import { AutoSuggestInput, type Suggestion } from "@/components/admin/AutoSuggestInput";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";
import { handleEnterAsNext } from "@/lib/enterKeyNav";
import { DeliveryRoutePicker } from "@/components/logistics/DeliveryRoutePicker";
import { type DocType, docLabel, docTagClasses, isPO } from "@/lib/docType";
import {
  saveNewQuotationDraft,
  loadNewQuotationDraft,
  clearNewQuotationDraft,
} from "@/lib/quotationDraft";

type Q = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  quotation_date: string;
  status: string;
  total: number;
  created_at: string;
  created_by: string | null;
  document_type: DocType;
  service_type?: string | null;
};

const AdminQuotations = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<Q[]>([]);
  const [creatorMap, setCreatorMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilterState] = useState<string>(searchParams.get("status") ?? "all");
  // Top-level "Quotation" vs "Purchase Order" tab. Stored in URL so deep-links work.
  const initialDocTab = (searchParams.get("doc") as DocType) ?? "quotation";
  const [docTab, setDocTabState] = useState<DocType>(initialDocTab);
  // The "create new" dialog can build either a quotation OR a PO. Defaults to
  // the active tab so the toggle always matches the user's current context.
  const [newDocType, setNewDocType] = useState<DocType>(initialDocTab);
  const [form, setForm] = useState({
    party_name: "",
    party_place: "",
    party_phone: "",
    delivery_place: "",
    delivery_route_id: null as string | null,
  });
  // Auto-save / resume state for the "New Quotation" dialog
  const [resumeOffered, setResumeOffered] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  // Keep state and URL ?status= in sync
  const setStatusFilter = (v: string) => {
    setStatusFilterState(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("status"); else next.set("status", v);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    const fromUrl = searchParams.get("status") ?? "all";
    if (fromUrl !== statusFilter) setStatusFilterState(fromUrl);
    const docFromUrl = (searchParams.get("doc") as DocType) ?? "quotation";
    if (docFromUrl !== docTab) setDocTabState(docFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setDocTab = (v: DocType) => {
    setDocTabState(v);
    setNewDocType(v);
    const next = new URLSearchParams(searchParams);
    if (v === "quotation") next.delete("doc"); else next.set("doc", v);
    setSearchParams(next, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotations")
      .select("id, quotation_id, party_name, party_place, party_phone, quotation_date, status, total, created_at, created_by, document_type, service_type")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    else {
      const list = (data ?? []) as Q[];
      setRows(list);
      // Fetch display names for unique created_by ids
      const ids = Array.from(new Set(list.map((r) => r.created_by).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", ids);
        const map: Record<string, string> = {};
        (profiles ?? []).forEach((p: any) => {
          map[p.user_id] = p.display_name || p.email || "Staff";
        });
        setCreatorMap(map);
      } else {
        setCreatorMap({});
      }
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Live updates: when any user creates/edits/deletes a quotation,
  // refresh the list. Debounced so a burst of updates only triggers one reload.
  useRealtimeQuotations(() => {
    if ((window as unknown as { __qListReloadTimer?: number }).__qListReloadTimer) {
      window.clearTimeout((window as unknown as { __qListReloadTimer?: number }).__qListReloadTimer);
    }
    (window as unknown as { __qListReloadTimer?: number }).__qListReloadTimer = window.setTimeout(() => {
      load();
    }, 400);
  });

  // ---- Auto-save the New Quotation form every 30s while the dialog is open.
  // Walking customers + interruptions = high data-loss risk. localStorage
  // survives browser close, accidental back, mobile screen-off, etc.
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      saveNewQuotationDraft(form);
      setDraftSavedAt(Date.now());
    };
    // Save immediately when fields change, but throttled to 30s like requested.
    const id = window.setInterval(tick, 30_000);
    // Also save on tab hide / page hide so a screen-off doesn't lose data.
    const onHide = () => saveNewQuotationDraft(form);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [open, form]);

  // ---- Resume prompt when opening the dialog with a saved draft.
  const handleOpenChange = (next: boolean) => {
    if (next && !open) {
      const draft = loadNewQuotationDraft();
      const formIsEmpty =
        !form.party_name.trim() && !form.party_place.trim() && !form.party_phone.trim();
      if (draft && formIsEmpty && !resumeOffered) {
        setResumeOffered(true);
        const ageMin = Math.max(1, Math.round((Date.now() - draft.savedAt) / 60_000));
        const resume = window.confirm(
          `Unfinished draft found (saved ~${ageMin} min ago).\n\n` +
            `Party: ${draft.party_name || "—"}\nPlace: ${draft.party_place || "—"}\n\n` +
            `Would you like to resume?`,
        );
        if (resume) {
          setForm({
            party_name: draft.party_name,
            party_place: draft.party_place,
            party_phone: draft.party_phone,
            delivery_place: draft.delivery_place ?? "",
            delivery_route_id: draft.delivery_route_id ?? null,
          });
          toast({ title: "Draft resumed" });
        } else {
          clearNewQuotationDraft();
        }
      }
    }
    if (!next) {
      // Save final state on close (don't lose data if they cancel).
      saveNewQuotationDraft(form);
      setResumeOffered(false);
    }
    setOpen(next);
  };

  const create = async () => {
    const placeRequired = !isPO(newDocType);
    if (!form.party_name.trim() || (placeRequired && !form.party_place.trim())) {
      toast({
        title: isPO(newDocType)
          ? "Worker / supplier name required"
          : "Party name and place required",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    // Generate the right ID depending on doc type — POs use a separate FY counter
    // so PO-2026/27-001 doesn't collide with quotation 2026/27-001.
    const rpcName = isPO(newDocType) ? "next_po_id" : "next_quotation_id";
    const { data: qid, error: qidErr } = await supabase.rpc(rpcName as any, {
      _party: form.party_name,
      _place: form.party_place || "NA",
    });
    if (qidErr || !qid) {
      setCreating(false);
      toast({ title: "Failed to generate ID", description: qidErr?.message, variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.from("quotations").insert({
      quotation_id: qid as string,
      party_name: form.party_name.trim(),
      party_place: form.party_place.trim() || "NA",
      party_phone: form.party_phone.trim() || null,
      delivery_place: form.delivery_place.trim() || null,
      delivery_route_id: form.delivery_route_id,
      document_type: newDocType,
      created_by: user?.id ?? null,
    }).select("id").single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      return;
    }
    // Successfully persisted to DB — drop the local draft.
    clearNewQuotationDraft();
    setOpen(false);
    setForm({ party_name: "", party_place: "", party_phone: "", delivery_place: "", delivery_route_id: null });
    navigate(`/admin/quotations/${data.id}`);
  };

  const remove = async (q: Q) => {
    if (!confirm(`Move ${q.quotation_id} to Trash? You can restore it for 30 days.`)) return;
    const { softDelete } = await import("@/lib/softDelete");
    const { error } = await softDelete("quotations", q.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Moved to Trash", description: "Restore from Admin → Trash within 30 days." }); load(); }
  };

  // All statuses we care about (order = lifecycle order)
  const STATUS_FILTERS = ["all", "draft", "drafted", "finalized", "sent", "accepted", "completed", "rejected"] as const;

  // Apply doc-type tab + search BEFORE the status filter so each tab's status
  // counts only count the rows visible in that tab.
  const docFiltered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter((r) => {
      // Treat missing document_type as 'quotation' (legacy rows).
      const t: DocType = (r.document_type as DocType) ?? "quotation";
      if (t !== docTab) return false;
      if (!s) return true;
      return (
        r.quotation_id.toLowerCase().includes(s) ||
        r.party_name.toLowerCase().includes(s) ||
        r.party_place.toLowerCase().includes(s)
      );
    });
  }, [rows, search, docTab]);

  const filtered = useMemo(
    () =>
      docFiltered.filter((r) => statusFilter === "all" || r.status === statusFilter),
    [docFiltered, statusFilter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docFiltered.length };
    for (const k of STATUS_FILTERS) if (k !== "all") c[k] = docFiltered.filter((r) => r.status === k).length;
    return c;
  }, [docFiltered]);

  // Top-level tab counts ignore the status filter so users always see how many
  // quotations vs POs exist overall (within the current search).
  const docCounts = useMemo(() => {
    const s = search.toLowerCase();
    const matchesSearch = (r: Q) =>
      !s ||
      r.quotation_id.toLowerCase().includes(s) ||
      r.party_name.toLowerCase().includes(s) ||
      r.party_place.toLowerCase().includes(s);
    return {
      quotation: rows.filter((r) => ((r.document_type as DocType) ?? "quotation") === "quotation" && matchesSearch(r)).length,
      po: rows.filter((r) => r.document_type === "po" && matchesSearch(r)).length,
    };
  }, [rows, search]);

  const renderRow = (q: Q) => (
    <Card key={q.id} className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {isPO(q.document_type) ? (
              <ShoppingCart className="mt-1 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            ) : (
              <FileText className="mt-1 h-4 w-4 shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="min-w-0 break-words font-mono text-sm font-semibold leading-snug">{q.quotation_id}</span>
                <Badge variant="outline" className={`w-fit shrink-0 ${docTagClasses(q.document_type)}`}>
                  {isPO(q.document_type) ? "PO" : "Quotation"}
                </Badge>
                <Badge variant={statusBadgeVariant(q.status)} className="w-fit shrink-0">{statusLabel(q.status)}</Badge>
                {q.service_type === "service" && (
                  <Badge variant="outline" className="w-fit shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    Service Request
                  </Badge>
                )}
                {q.service_type === "complaint-repair" && (
                  <Badge variant="outline" className="w-fit shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    Complaint Repair
                  </Badge>
                )}
              </div>
              <p className="rounded-md bg-primary/10 px-2 py-1 text-base font-semibold leading-snug text-primary break-words sm:text-lg">
                {q.party_name} <span className="text-primary/70">·</span> {q.party_place}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(q.quotation_date).toLocaleDateString("en-IN")}
                {q.created_by && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    · <User className="h-3 w-3" /> {creatorMap[q.created_by] ?? "Staff"}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="border-t border-border/50 pt-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {isPO(q.document_type) ? (
                <span className="text-sm text-muted-foreground">Work / material order</span>
              ) : (
                <span className="font-display text-lg font-semibold">{formatINR(q.total)}</span>
              )}
              <div className={`grid gap-2 sm:flex sm:items-center ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
                <Button size="sm" asChild className="h-10 w-full px-4 sm:w-auto">
                  <Link to={`/admin/quotations/${q.id}`}>Open <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="h-10 w-full sm:w-auto" onClick={() => remove(q)}>
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Quotations & Purchase Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Customer quotations and worker / supplier POs in one place.
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {isPO(docTab) ? "New purchase order" : "New quotation"}
            </Button>
          </DialogTrigger>
          <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
            <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
              <DialogTitle>{isPO(newDocType) ? "Create new purchase order" : "Create new quotation"}</DialogTitle>
            </DialogHeader>
            <div
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
              onFocusCapture={scrollFocusedIntoView}
              onKeyDown={(e) => handleEnterAsNext(e, () => { if (!creating) create(); })}
            >
              {/* Doc-type toggle: green Quotation ↔ blue PO */}
              <div className={`flex items-center justify-between rounded-lg border p-3 ${
                isPO(newDocType)
                  ? "border-blue-500/30 bg-blue-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
              }`}>
                <div className="flex items-center gap-2">
                  {isPO(newDocType) ? (
                    <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <div>
                    <Label className="cursor-pointer text-sm font-semibold">
                      {isPO(newDocType) ? "Purchase Order Mode" : "Quotation Mode"}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {isPO(newDocType)
                        ? "Send to a worker / supplier — no prices."
                        : "Customer quotation with pricing & GST."}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isPO(newDocType)}
                  onCheckedChange={(v) => setNewDocType(v ? "po" : "quotation")}
                  aria-label="Switch document type"
                />
              </div>
              <div className="flex justify-end">
                <ContactPicker
                  onPick={({ name, tel, place }) =>
                    setForm((f) => ({
                      ...f,
                      party_name: name || f.party_name,
                      party_phone: tel || f.party_phone,
                      party_place: place || f.party_place,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{isPO(newDocType) ? "Worker / Supplier name *" : "Customer name *"}</Label>
                {isPO(newDocType) ? (
                  <AutoSuggestInput<{ phone: string | null; whatsapp_number: string }>
                    value={form.party_name}
                    onChange={(v) => setForm((f) => ({ ...f, party_name: v }))}
                    placeholder="Type to search saved workers / suppliers, or enter new"
                    minChars={1}
                    fetchSuggestions={async (q) => {
                      const { data } = await supabase
                        .from("workers")
                        .select("name, trade, phone, whatsapp_number")
                        .ilike("name", `%${q}%`)
                        .eq("is_active", true)
                        .order("name")
                        .limit(8);
                      return (data ?? []).map((w) => ({
                        label: w.name,
                        sub: [w.trade, w.phone || w.whatsapp_number].filter(Boolean).join(" · "),
                        data: { phone: w.phone, whatsapp_number: w.whatsapp_number },
                      })) as Suggestion<{ phone: string | null; whatsapp_number: string }>[];
                    }}
                    onPick={(s) =>
                      setForm((f) => ({
                        ...f,
                        party_name: s.label,
                        party_phone: f.party_phone || s.data?.phone || s.data?.whatsapp_number || "",
                      }))
                    }
                  />
                ) : (
                  <Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{isPO(newDocType) ? "Place (optional)" : "Place *"}</Label>
                <Input
                  value={form.party_place}
                  onChange={(e) => setForm({ ...form, party_place: e.target.value })}
                  placeholder="e.g. Wayanad"
                />
              </div>
              <div className="space-y-1.5"><Label>Phone</Label><Input inputMode="tel" value={form.party_phone} onChange={(e) => setForm({ ...form, party_phone: e.target.value })} /></div>
              {!isPO(newDocType) && (
                <DeliveryRoutePicker
                  place={form.delivery_place}
                  routeId={form.delivery_route_id}
                  onChange={(v) => setForm({ ...form, delivery_place: v.place, delivery_route_id: v.routeId })}
                />
              )}
              <p className="text-xs text-muted-foreground">
                ID will auto-generate as{" "}
                <span className="font-mono">
                  {isPO(newDocType) ? "PO-2026/27-001" : "2026/27-001"} / Party / Place
                </span>{" "}
                (financial-year serial, never reused).
              </p>
              {draftSavedAt && (
                <p className="text-[11px] text-muted-foreground">
                  Auto-saved locally at {new Date(draftSavedAt).toLocaleTimeString("en-IN")} —
                  you can safely close and resume later.
                </p>
              )}
            </div>
            <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={create} disabled={creating} className="w-full sm:w-auto">{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create & open</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Top-level Quotation vs Purchase Order tabs */}
      <Tabs value={docTab} onValueChange={(v) => setDocTab(v as DocType)} className="mb-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="quotation" className="gap-1.5">
            <FileText className="h-4 w-4" /> Quotations ({docCounts.quotation})
          </TabsTrigger>
          <TabsTrigger value="po" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" /> Purchase Orders ({docCounts.po})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPO(docTab) ? "Search POs by ID, worker or place..." : "Search by ID, party or place..."}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-56">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((k) => (
              <SelectItem key={k} value={k}>
                {k === "all" ? "All statuses" : statusLabel(k)} ({counts[k] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="w-full justify-start overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto">
            {STATUS_FILTERS.map((k) => (
              <TabsTrigger key={k} value={k} className="capitalize whitespace-nowrap">
                {k === "all" ? "All" : statusLabel(k)} ({counts[k] ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={statusFilter} className="mt-4 grid gap-3">
            {filtered.map(renderRow)}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Nothing here yet.</p>}
          </TabsContent>
        </Tabs>
      )}
    </AdminShell>
  );
};

export default AdminQuotations;
