import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Phone, MapPin, Search, Inbox, AlertTriangle, Wrench, ShoppingBag, Ruler, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Kind = "lead" | "complaint" | "service";
type Row = {
  id: string;
  kind: Kind;
  code: string | null;
  name: string;
  phone: string | null;
  place: string | null;
  preview: string;
  enquiry_type?: string | null;
  created_at: string;
  raw: any;
};

const KIND_META: Record<Kind, { label: string; icon: any; cls: string }> = {
  lead: { label: "Lead", icon: ShoppingBag, cls: "bg-[#0E5C66] text-white hover:bg-[#0E5C66]/90" },
  complaint: { label: "Complaint", icon: AlertTriangle, cls: "bg-amber-600 text-white hover:bg-amber-600/90" },
  service: { label: "Service", icon: Wrench, cls: "bg-violet-600 text-white hover:bg-violet-600/90" },
};

const ENQUIRY_LABEL: Record<string, string> = {
  new_purchase: "New Purchase",
  custom_design: "Custom Design",
  delivery_installation: "Delivery & Installation",
  general_inquiry: "General Inquiry",
  complaint_replacement: "Complaint / Replacement",
  service_repair: "Service / Repair",
};

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const InboxPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  const [params, setParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    const [qRes, cRes, sRes] = await Promise.all([
      supabase
        .from("quotations")
        .select("id,quotation_id,party_name,party_phone,party_place,notes,enquiry_type,created_at,status,pipeline_stage,enquiry_contacted_at,lead_type")
        .is("deleted_at", null)
        .eq("lead_type", "lead")
        .is("enquiry_contacted_at", null)
        .not("status", "in", "(rejected,delivered)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("customer_complaints")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("customer_services")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const leads: Row[] = (qRes.data ?? []).map((r: any) => ({
      id: r.id, kind: "lead", code: r.quotation_id,
      name: r.party_name, phone: r.party_phone, place: r.party_place,
      preview: (r.notes ?? "").replace(/^Website enquiry — .*?\n+/, "").slice(0, 200),
      enquiry_type: r.enquiry_type, created_at: r.created_at, raw: r,
    }));
    const complaints: Row[] = (cRes.data ?? []).map((r: any) => ({
      id: r.id, kind: "complaint", code: r.complaint_code,
      name: r.customer_name, phone: r.customer_phone, place: r.customer_place,
      preview: r.issue_description ?? "", enquiry_type: "complaint_replacement",
      created_at: r.created_at, raw: r,
    }));
    const services: Row[] = (sRes.data ?? []).map((r: any) => ({
      id: r.id, kind: "service", code: r.service_code,
      name: r.customer_name, phone: r.customer_phone, place: r.customer_place,
      preview: [r.item_description, r.work_needed].filter(Boolean).join(" — "),
      enquiry_type: "service_repair",
      created_at: r.created_at, raw: r,
    }));

    const all = [...leads, ...complaints, ...services]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setRows(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Deep-link support: /admin/enquiries?open=complaint:<id> or service:<id> or lead:<id>.
  // Lets the legacy AdminComplaintEditor/AdminServiceEditor routes redirect here
  // and still land directly on the record, even if its status is no longer "pending".
  useEffect(() => {
    const raw = params.get("open");
    if (!raw) return;
    const [k, id] = raw.split(":");
    if (!id || !["lead", "complaint", "service"].includes(k)) return;
    (async () => {
      if (k === "lead") {
        const { data } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
        if (data) setOpen({
          id: data.id, kind: "lead", code: data.quotation_id,
          name: data.party_name, phone: data.party_phone, place: data.party_place,
          preview: (data.notes ?? "").replace(/^Website enquiry — .*?\n+/, ""),
          enquiry_type: data.enquiry_type, created_at: data.created_at, raw: data,
        });
      } else if (k === "complaint") {
        const { data } = await supabase.from("customer_complaints").select("*").eq("id", id).maybeSingle();
        if (data) setOpen({
          id: data.id, kind: "complaint", code: data.complaint_code,
          name: data.customer_name, phone: data.customer_phone, place: data.customer_place,
          preview: data.issue_description ?? "", enquiry_type: "complaint_replacement",
          created_at: data.created_at, raw: data,
        });
      } else {
        const { data } = await supabase.from("customer_services").select("*").eq("id", id).maybeSingle();
        if (data) setOpen({
          id: data.id, kind: "service", code: data.service_code,
          name: data.customer_name, phone: data.customer_phone, place: data.customer_place,
          preview: [data.item_description, data.work_needed].filter(Boolean).join(" — "),
          enquiry_type: "service_repair", created_at: data.created_at, raw: data,
        });
      }
      // Clear the param so refreshes don't keep re-opening.
      const next = new URLSearchParams(params);
      next.delete("open");
      setParams(next, { replace: true });
    })();
  }, [params, setParams]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.kind !== filter) return false;
      if (!needle) return true;
      return [r.name, r.phone, r.place, r.preview, r.code, r.enquiry_type]
        .some((v) => (v ?? "").toString().toLowerCase().includes(needle));
    });
  }, [rows, q, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    lead: rows.filter((r) => r.kind === "lead").length,
    complaint: rows.filter((r) => r.kind === "complaint").length,
    service: rows.filter((r) => r.kind === "service").length,
  }), [rows]);

  return (
    <AdminShell>
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="font-display text-2xl flex items-center gap-2">
          <Inbox className="h-6 w-6 text-primary" /> Enquiries Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          New website leads, complaints and service requests — chronological feed.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="lead">Leads ({counts.lead})</TabsTrigger>
            <TabsTrigger value="complaint">Complaints ({counts.complaint})</TabsTrigger>
            <TabsTrigger value="service">Services ({counts.service})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, place…" className="pl-8" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">No enquiries match.</p>
        ) : (
          filtered.map((r) => <RowCard key={`${r.kind}:${r.id}`} r={r} onOpen={() => setOpen(r)} />)
        )}
      </div>

      <EnquirySheet
        row={open}
        onClose={() => setOpen(null)}
        onChanged={() => { setOpen(null); load(); }}
      />
    </AdminShell>
  );
};

const RowCard = ({ r, onOpen }: { r: Row; onOpen: () => void }) => {
  const meta = KIND_META[r.kind];
  const Icon = meta.icon;
  return (
    <Card className="cursor-pointer transition hover:shadow-md" onClick={onOpen}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <Badge className={meta.cls}><Icon className="mr-1 h-3 w-3" />{meta.label}</Badge>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="font-semibold truncate">{r.name}</p>
              {r.enquiry_type && r.enquiry_type !== r.kind && (
                <span className="text-[11px] text-muted-foreground">
                  · {ENQUIRY_LABEL[r.enquiry_type] ?? r.enquiry_type}
                </span>
              )}
              {r.code && <span className="text-[11px] font-mono text-muted-foreground">· {r.code}</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {r.place && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.place}</span>}
              {r.phone && (
                <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()}
                   className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Phone className="h-3 w-3" />{r.phone}
                </a>
              )}
              <span>· {timeAgo(r.created_at)}</span>
            </div>
            {r.preview && (
              <p className="mt-1.5 line-clamp-2 text-sm text-foreground/80">{r.preview}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const EnquirySheet = ({ row, onClose, onChanged }: { row: Row | null; onClose: () => void; onChanged: () => void }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [measurementStaff, setMeasurementStaff] = useState<Array<{ user_id: string; name: string }>>([]);
  const [workers, setWorkers] = useState<Array<{ id: string; name: string }>>([]);
  const [assigneeId, setAssigneeId] = useState<string>("");

  useEffect(() => {
    setAssigneeId("");
    if (!row) return;
    if (row.kind === "lead") {
      (async () => {
        // No FK between user_roles and profiles (both reference auth.users),
        // so PostgREST can't embed — fetch in two steps.
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "measurement_staff");
        const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
        if (ids.length === 0) {
          setMeasurementStaff([]);
          return;
        }
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,display_name,email")
          .in("user_id", ids);
        const byId = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        setMeasurementStaff(
          ids.map((uid: string) => {
            const p: any = byId.get(uid);
            return {
              user_id: uid,
              name: p?.display_name || p?.email || uid.slice(0, 8),
            };
          }),
        );
      })();
    } else {
      (async () => {
        const { data } = await supabase
          .from("workers")
          .select("id,name,is_active")
          .is("deleted_at", null)
          .eq("is_active", true)
          .order("name");
        setWorkers((data ?? []).map((w: any) => ({ id: w.id, name: w.name })));
      })();
    }
  }, [row?.id, row?.kind]);

  if (!row) return null;
  const meta = KIND_META[row.kind];

  const markLeadContacted = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("quotations")
      .update({ enquiry_contacted_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Marked as contacted");
    onChanged();
  };

  const assignToMeasurement = async () => {
    if (!assigneeId) return toast.error("Pick a measurement staff");
    setBusy(true);
    const r = row.raw;
    const { error } = await supabase.from("measurement_tasks").insert({
      customer_name: r.party_name,
      customer_phone: r.party_phone,
      customer_place: r.party_place,
      requirement: r.notes,
      assigned_to: assigneeId,
      status: "pending",
      draft_quotation_id: r.id,
      created_by: user?.id ?? null,
    });
    if (!error) {
      await supabase.from("quotations")
        .update({ enquiry_contacted_at: new Date().toISOString(), pipeline_stage: 2 })
        .eq("id", row.id);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Assigned to measurement");
    onChanged();
  };

  const assignWorker = async () => {
    if (!assigneeId) return toast.error("Pick a worker");
    setBusy(true);
    const payload: any = {
      worker_id: assigneeId,
      item_ids: [],
      status: "assigned",
      job_type: row.kind === "complaint" ? "complaint" : "service",
      created_by: user?.id ?? null,
      notes: `${meta.label} ${row.code ?? ""} — ${row.name} (${row.place ?? ""})\n${row.preview ?? ""}`,
    };
    if (row.kind === "complaint") payload.source_complaint_id = row.id;
    if (row.kind === "service") payload.source_service_id = row.id;
    const { error } = await supabase.from("job_work_orders").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Assigned to worker");
    onChanged();
  };

  const markResolved = async () => {
    setBusy(true);
    const table = row.kind === "complaint" ? "customer_complaints" : "customer_services";
    const { error } = await supabase.from(table).update({ status: "resolved" }).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Marked resolved");
    onChanged();
  };

  const Icon = meta.icon;
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge className={meta.cls}><Icon className="mr-1 h-3 w-3" />{meta.label}</Badge>
            <span className="truncate">{row.name}</span>
          </SheetTitle>
          <SheetDescription>
            {row.code && <span className="font-mono">{row.code} · </span>}
            {timeAgo(row.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3 text-sm">
          {row.enquiry_type && (
            <Field label="Type">{ENQUIRY_LABEL[row.enquiry_type] ?? row.enquiry_type}</Field>
          )}
          {row.place && <Field label="Place">{row.place}</Field>}
          {row.phone && (
            <Field label="Phone">
              <a href={`tel:${row.phone}`} className="text-primary hover:underline">{row.phone}</a>
            </Field>
          )}
          <Field label={row.kind === "lead" ? "Message" : row.kind === "complaint" ? "Issue" : "Work needed"}>
            <p className="whitespace-pre-wrap">{row.preview || "—"}</p>
          </Field>
          {row.kind === "complaint" && row.raw.original_quotation_code && (
            <Field label="Original bill">{row.raw.original_quotation_code}</Field>
          )}
          {row.kind === "complaint" && (() => {
            const raw = row.raw.photos;
            const urls: string[] = Array.isArray(raw)
              ? raw.filter(Boolean)
              : typeof raw === "string" && raw.trim()
                ? raw.split(/[\s,]+/).filter((u) => /^https?:\/\//i.test(u))
                : [];
            if (urls.length === 0) return null;
            return (
              <Field label="Photos">
                <div className="flex flex-wrap gap-2">
                  {urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" className="h-20 w-20 rounded-md object-cover" />
                    </a>
                  ))}
                </div>
              </Field>
            );
          })()}
        </div>

        <div className="mt-6 space-y-3 border-t pt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>

          {row.kind === "lead" ? (
            <>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Assign to Measurement Staff</p>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue placeholder="Pick measurement staff" /></SelectTrigger>
                  <SelectContent>
                    {measurementStaff.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>
                    ))}
                    {measurementStaff.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No measurement staff yet</div>
                    )}
                  </SelectContent>
                </Select>
                <Button onClick={assignToMeasurement} disabled={busy || !assigneeId} className="w-full">
                  <Ruler className="mr-2 h-4 w-4" /> Assign to Measurement
                </Button>
              </div>
              <Button variant="outline" onClick={markLeadContacted} disabled={busy} className="w-full">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Contacted
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Assign to Worker</p>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue placeholder="Pick worker" /></SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                    {workers.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No active workers</div>
                    )}
                  </SelectContent>
                </Select>
                <Button onClick={assignWorker} disabled={busy || !assigneeId} className="w-full">
                  <Wrench className="mr-2 h-4 w-4" /> Assign to Worker
                </Button>
              </div>
              <Button variant="outline" onClick={markResolved} disabled={busy} className="w-full">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Resolved
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[110px_1fr] gap-2">
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    <div>{children}</div>
  </div>
);

const AdminEnquiriesInbox = () => (
  <OfficeStaffOnly><InboxPage /></OfficeStaffOnly>
);

export default AdminEnquiriesInbox;