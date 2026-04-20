import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, FileText, ArrowRight, Trash2, Search, Filter } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatINR } from "@/lib/brand";
import { statusBadgeVariant, statusLabel } from "./AdminQuotationEditor";
import { ContactPicker } from "@/components/admin/ContactPicker";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";

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
};

const AdminQuotations = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilterState] = useState<string>(searchParams.get("status") ?? "all");
  const [form, setForm] = useState({ party_name: "", party_place: "", party_phone: "" });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotations")
      .select("id, quotation_id, party_name, party_place, party_phone, quotation_date, status, total, created_at")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    else setRows((data ?? []) as Q[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.party_name.trim() || !form.party_place.trim()) {
      toast({ title: "Party name and place required", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data: qid, error: qidErr } = await supabase.rpc("next_quotation_id", {
      _party: form.party_name,
      _place: form.party_place,
    });
    if (qidErr || !qid) {
      setCreating(false);
      toast({ title: "Failed to generate ID", description: qidErr?.message, variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.from("quotations").insert({
      quotation_id: qid as string,
      party_name: form.party_name.trim(),
      party_place: form.party_place.trim(),
      party_phone: form.party_phone.trim() || null,
      created_by: user?.id ?? null,
    }).select("id").single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ party_name: "", party_place: "", party_phone: "" });
    navigate(`/admin/quotations/${data.id}`);
  };

  const remove = async (q: Q) => {
    if (!confirm(`Delete ${q.quotation_id}?`)) return;
    const { error } = await supabase.from("quotations").delete().eq("id", q.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); load(); }
  };

  // All statuses we care about (order = lifecycle order)
  const STATUS_FILTERS = ["all", "draft", "drafted", "finalized", "sent", "accepted", "completed", "rejected"] as const;
  type StatusKey = (typeof STATUS_FILTERS)[number];

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !s || r.quotation_id.toLowerCase().includes(s) || r.party_name.toLowerCase().includes(s) || r.party_place.toLowerCase().includes(s);
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  // Counts per status (over the search-filtered set, ignoring the status filter itself)
  const counts = useMemo(() => {
    const s = search.toLowerCase();
    const base = rows.filter((r) => !s || r.quotation_id.toLowerCase().includes(s) || r.party_name.toLowerCase().includes(s) || r.party_place.toLowerCase().includes(s));
    const c: Record<string, number> = { all: base.length };
    for (const k of STATUS_FILTERS) if (k !== "all") c[k] = base.filter((r) => r.status === k).length;
    return c;
  }, [rows, search]);

  const renderRow = (q: Q) => (
    <Card key={q.id}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-mono text-sm font-semibold">{q.quotation_id}</span>
            <Badge variant={statusBadgeVariant(q.status)} className="shrink-0">{statusLabel(q.status)}</Badge>
          </div>
          <p className="mt-1 truncate text-sm">{q.party_name} · {q.party_place}</p>
          <p className="text-xs text-muted-foreground">{new Date(q.quotation_date).toLocaleDateString("en-IN")}</p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="font-display text-lg font-semibold">{formatINR(q.total)}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild><Link to={`/admin/quotations/${q.id}`}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
            {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove(q)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Quotations</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Create, manage and share customer quotations.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> New quotation</Button></DialogTrigger>
          <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
            <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
              <DialogTitle>Create new quotation</DialogTitle>
            </DialogHeader>
            <div
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
              onFocusCapture={scrollFocusedIntoView}
            >
              <div className="flex justify-end">
                <ContactPicker
                  onPick={({ name, tel }) =>
                    setForm((f) => ({
                      ...f,
                      party_name: name || f.party_name,
                      party_phone: tel || f.party_phone,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5"><Label>Party name *</Label><Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Place *</Label><Input value={form.party_place} onChange={(e) => setForm({ ...form, party_place: e.target.value })} placeholder="e.g. Wayanad" /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input inputMode="tel" value={form.party_phone} onChange={(e) => setForm({ ...form, party_phone: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">ID will auto-generate as <span className="font-mono">2026/27-001 / Party / Place</span> (financial-year serial, never reused).</p>
            </div>
            <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
              <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={create} disabled={creating} className="w-full sm:w-auto">{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create & open</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, party or place..." className="pl-9" />
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
