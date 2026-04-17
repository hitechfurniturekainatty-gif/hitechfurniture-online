import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, FileText, ArrowRight, Trash2, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatINR } from "@/lib/brand";

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
  const [rows, setRows] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ party_name: "", party_place: "", party_phone: "" });

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

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase();
    return !s || r.quotation_id.toLowerCase().includes(s) || r.party_name.toLowerCase().includes(s) || r.party_place.toLowerCase().includes(s);
  });

  const groups = {
    draft: filtered.filter((r) => r.status === "draft"),
    sent: filtered.filter((r) => r.status === "sent"),
    accepted: filtered.filter((r) => r.status === "accepted"),
    all: filtered,
  };

  const statusColor = (s: string) =>
    s === "accepted" ? "default" : s === "sent" ? "secondary" : s === "rejected" ? "destructive" : "outline";

  const renderRow = (q: Q) => (
    <Card key={q.id}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="font-mono text-sm font-semibold truncate">{q.quotation_id}</span>
            <Badge variant={statusColor(q.status) as any} className="shrink-0">{q.status}</Badge>
          </div>
          <p className="mt-1 text-sm truncate">{q.party_name} · {q.party_place}</p>
          <p className="text-xs text-muted-foreground">{new Date(q.quotation_date).toLocaleDateString("en-IN")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold">{formatINR(q.total)}</span>
          <Button size="sm" asChild><Link to={`/admin/quotations/${q.id}`}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove(q)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Quotations</h1>
          <p className="mt-1 text-muted-foreground">Create, manage and share customer quotations.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New quotation</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create new quotation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Party name *</Label><Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Place *</Label><Input value={form.party_place} onChange={(e) => setForm({ ...form, party_place: e.target.value })} placeholder="e.g. Wayanad" /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.party_phone} onChange={(e) => setForm({ ...form, party_phone: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">ID will auto-generate as <span className="font-mono">PartyName-Place-001</span></p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={creating}>{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create & open</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, party or place..." className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({groups.all.length})</TabsTrigger>
            <TabsTrigger value="draft">Drafts ({groups.draft.length})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({groups.sent.length})</TabsTrigger>
            <TabsTrigger value="accepted">Accepted ({groups.accepted.length})</TabsTrigger>
          </TabsList>
          {(["all", "draft", "sent", "accepted"] as const).map((k) => (
            <TabsContent key={k} value={k} className="mt-4 grid gap-3">
              {groups[k].map((q) => <Row key={q.id} q={q} />)}
              {groups[k].length === 0 && <p className="text-center text-muted-foreground py-8">Nothing here yet.</p>}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AdminShell>
  );
};

export default AdminQuotations;
