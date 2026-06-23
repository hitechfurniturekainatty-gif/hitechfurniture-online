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
import { statusBadgeVariant, statusLabel, normalizeStatus } from "./AdminQuotationEditor";
import { ContactPicker } from "@/components/admin/ContactPicker";
import { AutoSuggestInput, type Suggestion } from "@/components/admin/AutoSuggestInput";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";
import { handleEnterAsNext } from "@/lib/enterKeyNav";
import { DeliveryRoutePicker } from "@/components/logistics/DeliveryRoutePicker";
import { type DocType, docLabel, docTagClasses, isPO } from "@/lib/docType";
import { titleCaseTrim, toTitleCase } from "@/lib/textCase";
import { computeStage, stageToneClasses, ALL_STAGES, STAGE_DEFS, type PipelineStage } from "@/lib/quotationPipeline";
import { HelpHint } from "@/components/help/HelpHint";
import { ActionHint } from "@/components/help/ActionHint";
import { PipelineSteps } from "@/components/admin/PipelineSteps";
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
  updated_at?: string | null;
  updated_by?: string | null;
  document_type: DocType;
  service_type?: string | null;
  salesperson_name?: string | null;
  advance_amount?: number | null;
  submitted_for_pricing_at?: string | null;
  is_direct_order?: boolean | null;
  source_task_id?: string | null;
  lead_type?: string | null;
  pipeline_stage?: number | null;
};

type StageFilterKey =
  | "all"
  | "active"
  | "confirmed"
  | "stage1"
  | "stage2"
  | "stage3"
  | "stage4"
  | "stage5"
  | "stage6"
  | "rejected";

const STAGE_FILTER_KEYS: StageFilterKey[] = [
  "active",
  "confirmed",
  "all",
  "stage1",
  "stage2",
  "stage3",
  "stage4",
  "stage5",
  "stage6",
  "rejected",
];

const stageFilterLabel = (k: StageFilterKey) => {
  if (k === "all") return "All";
  if (k === "active") return "Active";
  if (k === "confirmed") return "Confirmed Orders";
  if (k === "rejected") return "Rejected";
  const num = Number(k.replace("stage", "")) as PipelineStage;
  return STAGE_DEFS[num].label;
};

const AdminQuotations = () => {
  const { user, isAdmin, isOfficeStaff, isWarehouse, isDelivery, isMeasurementStaff } = useAuth();
  const navigate = useNavigate();
  // Strict gating: Warehouse & Delivery must NEVER see the all-quotations list.
  // Redirect them to their own dashboard immediately.
  useEffect(() => {
    if (!isOfficeStaff && !isAdmin && !isMeasurementStaff) {
      if (isWarehouse) navigate("/admin/warehouse", { replace: true });
      else if (isDelivery) navigate("/admin/my-trips", { replace: true });
    }
  }, [isOfficeStaff, isAdmin, isMeasurementStaff, isWarehouse, isDelivery, navigate]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<Q[]>([]);
  const [jobAgg, setJobAgg] = useState<Record<string, { total: number; done: number; in_warehouse: number; dispatched: number }>>({});
  const [tripAgg, setTripAgg] = useState<Record<string, { has: boolean; completed: boolean }>>({});
  const [itemAgg, setItemAgg] = useState<Record<string, { total: number; ready: number; custom: number }>>({});
  const [creatorMap, setCreatorMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilterState] = useState<string>(searchParams.get("status") ?? "active");
  const [staffFilter, setStaffFilterState] = useState<string>(searchParams.get("staff") ?? "all");
  const [salesFilter, setSalesFilterState] = useState<string>(searchParams.get("sales") ?? "all");
  const [leadFilter, setLeadFilterState] = useState<string>(searchParams.get("lead") ?? "all");
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
    is_direct_order: false,
    lead_type: "lead" as "lead" | "direct_deal" | "consultation" | "custom_project",
    assigned_to: "" as string,
    salesperson_name: "" as string,
  });
  // Measurement staff list — lazy-loaded when "Custom Project" is chosen so we
  // can auto-create a Dimensions task on save (real Stage-2 routing, not just a tag).
  const [measurementStaff, setMeasurementStaff] = useState<
    { user_id: string; email: string | null; display_name: string | null; whatsapp_number: string | null; role: string | null }[]
  >([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  // All sales-capable staff names — used to populate the salesperson picker
  // inside the New Quotation dialog.
  const [salesStaffOptions, setSalesStaffOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("list-staff-users");
      if (cancelled || error) return;
      const users = (data?.users ?? []) as Array<{ display_name?: string | null; email?: string | null; role?: string | null }>;
      const names = users
        .filter((u) => u.role && u.role !== "delivery")
        .map((u) => (u.display_name || u.email || "").trim())
        .filter(Boolean);
      setSalesStaffOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
    })();
    return () => { cancelled = true; };
  }, [open]);
  // Auto-save / resume state for the "New Quotation" dialog
  const [resumeOffered, setResumeOffered] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  // Keep state and URL ?status= in sync
  const setStatusFilter = (v: string) => {
    setStatusFilterState(v);
    const next = new URLSearchParams(searchParams);
    if (v === "active") next.delete("status"); else next.set("status", v);
    setSearchParams(next, { replace: true });
  };
  const setStaffFilter = (v: string) => {
    setStaffFilterState(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("staff"); else next.set("staff", v);
    setSearchParams(next, { replace: true });
  };
  const setSalesFilter = (v: string) => {
    setSalesFilterState(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("sales"); else next.set("sales", v);
    setSearchParams(next, { replace: true });
  };
  const setLeadFilter = (v: string) => {
    setLeadFilterState(v);
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("lead"); else next.set("lead", v);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    const fromUrl = searchParams.get("status") ?? "active";
    if (fromUrl !== statusFilter) setStatusFilterState(fromUrl);
    const docFromUrl = (searchParams.get("doc") as DocType) ?? "quotation";
    if (docFromUrl !== docTab) setDocTabState(docFromUrl);
    const staffFromUrl = searchParams.get("staff") ?? "all";
    if (staffFromUrl !== staffFilter) setStaffFilterState(staffFromUrl);
    const salesFromUrl = searchParams.get("sales") ?? "all";
    if (salesFromUrl !== salesFilter) setSalesFilterState(salesFromUrl);
    const leadFromUrl = searchParams.get("lead") ?? "all";
    if (leadFromUrl !== leadFilter) setLeadFilterState(leadFromUrl);
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
    const [{ data, error }, jRes, tqRes, itRes] = await Promise.all([
      supabase
        .from("quotations")
        .select("id, quotation_id, party_name, party_place, party_phone, quotation_date, status, total, created_at, created_by, updated_at, updated_by, document_type, service_type, salesperson_name, advance_amount, submitted_for_pricing_at, is_direct_order, source_task_id, lead_type, pipeline_stage")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("job_work_orders").select("quotation_id, status, warehouse_status").is("deleted_at", null),
      supabase.from("trip_quotations").select("quotation_id, delivered_at, trips:trip_id(status)") as any,
      supabase.from("quotation_items").select("quotation_id, fulfillment_route") as any,
    ]);
    // Aggregate jobs per quotation
    const jobs: Record<string, { total: number; done: number; in_warehouse: number; dispatched: number }> = {};
    ((jRes.data ?? []) as any[]).forEach((j) => {
      if (!j.quotation_id) return;
      const cur = jobs[j.quotation_id] ?? { total: 0, done: 0, in_warehouse: 0, dispatched: 0 };
      cur.total += 1;
      if (j.status === "completed" || j.status === "done") cur.done += 1;
      const ws = j.warehouse_status;
      if (ws === "in_warehouse" || ws === "ready_to_pack" || ws === "ready_for_dispatch") cur.in_warehouse += 1;
      if (ws === "dispatched") cur.dispatched += 1;
      jobs[j.quotation_id] = cur;
    });
    setJobAgg(jobs);
    const trips: Record<string, { has: boolean; completed: boolean }> = {};
    ((tqRes.data ?? []) as any[]).forEach((tq) => {
      const qid = tq.quotation_id as string;
      const cur = trips[qid] ?? { has: false, completed: false };
      cur.has = true;
      if (tq.trips?.status === "completed" || tq.delivered_at) cur.completed = true;
      trips[qid] = cur;
    });
    setTripAgg(trips);
    const itemAggMap: Record<string, { total: number; ready: number; custom: number }> = {};
    ((itRes.data ?? []) as any[]).forEach((it) => {
      const qid = it.quotation_id as string;
      if (!qid) return;
      const cur = itemAggMap[qid] ?? { total: 0, ready: 0, custom: 0 };
      cur.total += 1;
      if (it.fulfillment_route === "custom") cur.custom += 1;
      else cur.ready += 1;
      itemAggMap[qid] = cur;
    });
    setItemAgg(itemAggMap);
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    else {
      const list = (data ?? []) as Q[];
      // Strict creation-date ordering: editing an older quotation must NOT
      // bubble it to the top. The query already orders by created_at desc.
      setRows(list);
      // Fetch display names for unique created_by + updated_by ids
      const ids = Array.from(new Set([
        ...list.map((r) => r.created_by),
        ...list.map((r) => r.updated_by),
      ].filter(Boolean) as string[]));
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

  // ---- Scroll restoration --------------------------------------------------
  // Persist the list's vertical scroll position between visits so opening
  // the 26th quotation and returning lands the user exactly where they were.
  const SCROLL_KEY = "adminQuotationsScrollY";
  // Save on scroll (throttled via rAF).
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch { /* ignore */ }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  // Restore once rows are present.
  const restoredScrollRef = (typeof window !== "undefined") ? (window as any) : {};
  useEffect(() => {
    if (loading || rows.length === 0) return;
    if ((restoredScrollRef as any).__qListScrollRestored) return;
    const raw = sessionStorage.getItem(SCROLL_KEY);
    const y = raw ? Number(raw) : 0;
    if (y > 0) {
      // Wait one frame so the list is painted before scrolling.
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
    }
    (restoredScrollRef as any).__qListScrollRestored = true;
    // Reset the guard when the user leaves the page so a future return restores again.
    return () => { (restoredScrollRef as any).__qListScrollRestored = false; };
  }, [loading, rows.length]);

  // Lazy-load measurement staff the first time the user picks "Custom Project"
  // (or opens the dialog with that already chosen).
  useEffect(() => {
    if (!open || form.lead_type !== "custom_project" || staffLoaded) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("list-staff-users");
      if (error) {
        toast({ title: "Couldn't load staff list", description: error.message, variant: "destructive" });
        return;
      }
      const all = (data?.users ?? []) as typeof measurementStaff;
      setMeasurementStaff(all.filter((u) => u.role === "measurement_staff" || u.role === "staff" || u.role === "admin"));
      setStaffLoaded(true);
    })();
  }, [open, form.lead_type, staffLoaded]);

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
            is_direct_order: false,
            lead_type: "lead",
            assigned_to: "",
            salesperson_name: "",
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
    const isQuotation = !isPO(newDocType);
    const lt = isQuotation ? form.lead_type : "lead";
    const isDirect = isQuotation && lt === "direct_deal";
    const isCustom = isQuotation && lt === "custom_project";
    const nowIso = new Date().toISOString();

    // Stage-2 routing: for Custom Projects, create the measurement task FIRST so
    // we can stamp source_task_id on the quotation. That's what makes
    // computeStage() report Stage 2 (Dimensions) and what makes the task show
    // up in the assignee's Pending list immediately.
    let sourceTaskId: string | null = null;
    if (isCustom) {
      // Auto-assign to the measurement staff. We have a single measurement
      // staff in the team, so look them up and assign directly — no shared
      // pool, no manual picker.
      let assigneeId: string | null = null;
      const { data: msRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "measurement_staff");
      if (msRoles && msRoles.length >= 1) {
        assigneeId = msRoles[0].user_id as string;
      }
      const { data: task, error: taskErr } = await supabase
        .from("measurement_tasks")
        .insert({
          customer_name: titleCaseTrim(form.party_name),
          customer_place: form.party_place.trim() || "NA",
          customer_phone: form.party_phone.trim() || null,
          requirement: null,
          assigned_to: assigneeId,
          created_by: user?.id ?? null,
          status: "pending",
        })
        .select("id")
        .single();
      if (taskErr || !task) {
        setCreating(false);
        toast({ title: "Couldn't create Dimensions task", description: taskErr?.message, variant: "destructive" });
        return;
      }
      sourceTaskId = task.id as string;
    }

    // Salesperson attribution — record the creating staff's display name on the
    // quotation regardless of category (used by the "Salesperson" filter).
    let salespersonName: string | null = form.salesperson_name.trim() || null;
    if (!salespersonName && user?.id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      salespersonName = prof?.display_name || prof?.email || null;
    }

    const { data, error } = await supabase.from("quotations").insert({
      quotation_id: qid as string,
      party_name: titleCaseTrim(form.party_name),
      party_place: form.party_place.trim() || "NA",
      party_phone: form.party_phone.trim() || null,
      delivery_place: form.delivery_place.trim() || null,
      delivery_route_id: form.delivery_route_id,
      document_type: newDocType,
      is_direct_order: isDirect,
      lead_type: lt,
      // Direct deals skip Client Hub + Dimensions and land straight in OPS for pricing.
      submitted_for_pricing_at: isDirect ? nowIso : null,
      source_task_id: sourceTaskId,
      salesperson_name: salespersonName,
      created_by: user?.id ?? null,
    }).select("id").single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      return;
    }
    // Link the freshly-created task back to the draft so the assignee can open it.
    if (sourceTaskId) {
      await supabase
        .from("measurement_tasks")
        .update({ draft_quotation_id: data.id })
        .eq("id", sourceTaskId);
    }
    // Successfully persisted to DB — drop the local draft.
    clearNewQuotationDraft();
    setOpen(false);
    setForm({ party_name: "", party_place: "", party_phone: "", delivery_place: "", delivery_route_id: null, is_direct_order: false, lead_type: "lead", assigned_to: "", salesperson_name: "" });
    if (isCustom) {
      toast({
        title: "Custom Project created",
        description: "A pending Dimensions task has been assigned. It now sits in Stage 2.",
      });
    } else if (isDirect) {
      toast({ title: "Direct Deal created", description: "Moved to OPS for pricing." });
    }
    // Refresh list so the new row + correct stage appears immediately
    // (in addition to the realtime channel).
    load();
    navigate(`/admin/quotations/${data.id}`);
  };

  const remove = async (q: Q) => {
    if (!confirm(`Move ${q.quotation_id} to Trash? You can restore it for 30 days.`)) return;
    const { softDelete } = await import("@/lib/softDelete");
    const { error } = await softDelete("quotations", q.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      setRows((prev) => prev.filter((r) => r.id !== q.id));
      toast({ title: "Moved to Trash", description: "Restore from Admin → Trash within 30 days." });
      load();
    }
  };

  // Direct stage change for admin/staff — manually transition a quotation
  // to any pipeline stage from the Client Hub list. Uses the quotations RLS
  // update policy (admin/staff already permitted).
  const changeStage = async (q: Q, nextStage: PipelineStage) => {
    const { error } = await supabase
      .from("quotations")
      .update({ pipeline_stage: nextStage })
      .eq("id", q.id);
    if (error) {
      toast({ title: "Couldn't move stage", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Moved to Stage ${nextStage}: ${STAGE_DEFS[nextStage].label}` });
    load();
  };

  // Helper: compute the full stage for a quotation using aggregates.
  const stageFor = (q: Q) =>
    computeStage({
      status: q.status,
      advance_amount: q.advance_amount,
      submitted_for_pricing_at: q.submitted_for_pricing_at,
      is_direct_order: q.is_direct_order,
      source_task_id: q.source_task_id,
      jobs_total: jobAgg[q.id]?.total ?? 0,
      jobs_completed: jobAgg[q.id]?.done ?? 0,
      jobs_in_warehouse: jobAgg[q.id]?.in_warehouse ?? 0,
      jobs_dispatched: jobAgg[q.id]?.dispatched ?? 0,
      has_trip: tripAgg[q.id]?.has ?? false,
      trip_completed: tripAgg[q.id]?.completed ?? false,
      items_total: itemAgg[q.id]?.total ?? 0,
      items_ready_stock: itemAgg[q.id]?.ready ?? 0,
      items_custom: itemAgg[q.id]?.custom ?? 0,
    });

  // Apply doc-type tab + search BEFORE the status filter so each tab's status
  // counts only count the rows visible in that tab.
  const docFiltered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter((r) => {
      // Treat missing document_type as 'quotation' (legacy rows).
      const t: DocType = (r.document_type as DocType) ?? "quotation";
      if (t !== docTab) return false;
      if (!isPO(t) && leadFilter !== "all") {
        const lt = (r.lead_type ?? "lead").toString();
        if (lt !== leadFilter) return false;
      }
      if (isOfficeStaff && staffFilter !== "all") {
        if (staffFilter === "__none__") {
          if (r.created_by) return false;
        } else if (r.created_by !== staffFilter) {
          return false;
        }
      }
      if (isOfficeStaff && salesFilter !== "all") {
        const name = (r.salesperson_name ?? "").trim();
        if (salesFilter === "__none__") {
          if (name) return false;
        } else if (name !== salesFilter) {
          return false;
        }
      }
      if (!s) return true;
      return (
        r.quotation_id.toLowerCase().includes(s) ||
        r.party_name.toLowerCase().includes(s) ||
        r.party_place.toLowerCase().includes(s)
      );
    });
  }, [rows, search, docTab, staffFilter, salesFilter, leadFilter, isOfficeStaff]);

  // Distinct staff options derived from the loaded rows (within current doc tab).
  const staffOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number }>();
    rows.forEach((r) => {
      const t: DocType = (r.document_type as DocType) ?? "quotation";
      if (t !== docTab) return;
      if (!r.created_by) return;
      const name = creatorMap[r.created_by] ?? "Staff";
      const ex = seen.get(r.created_by);
      if (ex) ex.count += 1;
      else seen.set(r.created_by, { id: r.created_by, name, count: 1 });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, creatorMap, docTab]);

  // Distinct salesperson names from current doc tab.
  const salesOptions = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const t: DocType = (r.document_type as DocType) ?? "quotation";
      if (t !== docTab) return;
      const name = (r.salesperson_name ?? "").trim();
      if (!name) return;
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, docTab]);

  const filtered = useMemo(
    () =>
      docFiltered.filter((r) => {
        const s = normalizeStatus(r.status);
        if (statusFilter === "all") return true;
        if (statusFilter === "rejected") return s === "rejected";
        // Hide rejected from every other tab.
        if (s === "rejected") return false;
        if (statusFilter === "active") return s !== "delivered";
        if (statusFilter === "confirmed") {
          return (s === "finalized" || s === "delivered") && (r.advance_amount ?? 0) > 0;
        }
        if (statusFilter.startsWith("stage")) {
          const num = Number(statusFilter.replace("stage", "")) as PipelineStage;
          return stageFor(r).stage === num;
        }
        return true;
      }),
    [docFiltered, statusFilter, jobAgg, tripAgg],
  );

  const counts = useMemo(() => {
    const nonRejected = docFiltered.filter((r) => normalizeStatus(r.status) !== "rejected");
    const c: Record<string, number> = {
      all: docFiltered.length,
      active: nonRejected.filter((r) => normalizeStatus(r.status) !== "delivered").length,
      confirmed: nonRejected.filter((r) => {
        const s = normalizeStatus(r.status);
        return (s === "finalized" || s === "delivered") && (r.advance_amount ?? 0) > 0;
      }).length,
      rejected: docFiltered.filter((r) => normalizeStatus(r.status) === "rejected").length,
      stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0, stage6: 0,
    };
    nonRejected.forEach((r) => {
      const st = stageFor(r).stage;
      c[`stage${st}`] = (c[`stage${st}`] ?? 0) + 1;
    });
    return c;
  }, [docFiltered, jobAgg, tripAgg]);

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
                {q.is_direct_order && !isPO(q.document_type) && (
                  <Badge variant="outline" className="w-fit shrink-0 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    Direct Order
                  </Badge>
                )}
              </div>
              <p className="rounded-md bg-primary/10 px-2 py-1 text-base font-semibold leading-snug text-primary break-words sm:text-lg">
                {titleCaseTrim(q.party_name)} <span className="text-primary/70">·</span> {q.party_place}
                {q.party_phone && (
                  <>
                    {" "}<span className="text-primary/70">·</span>{" "}
                    <a
                      href={`tel:${q.party_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                    >
                      {q.party_phone}
                    </a>
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(q.quotation_date).toLocaleDateString("en-IN")}
                {q.created_by && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    · <User className="h-3 w-3" /> {creatorMap[q.created_by] ?? "Staff"}
                  </span>
                )}
                {q.salesperson_name && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    · Sales: <span className="font-medium text-foreground">{q.salesperson_name}</span>
                  </span>
                )}
                {q.updated_by && q.updated_at && q.updated_by !== q.created_by && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    · Edited by <span className="font-medium text-foreground">{creatorMap[q.updated_by] ?? "Staff"}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          {!isPO(q.document_type) && (() => {
            const info = stageFor(q);
            return (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <Badge variant="outline" className={stageToneClasses(info.tone)}>
                    Stage {info.stage}: {info.label}
                  </Badge>
                  <span className="text-muted-foreground">With: <span className="font-semibold text-foreground">{info.owner}</span></span>
                  {(isAdmin || isOfficeStaff) && (
                    <Select
                      value={String(info.stage)}
                      onValueChange={(v) => changeStage(q, Number(v) as PipelineStage)}
                    >
                      <SelectTrigger className="h-7 w-[170px] text-[11px]">
                        <SelectValue placeholder="Move to…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STAGES.map((s) => (
                          <SelectItem key={s} value={String(s)} className="text-xs">
                            Stage {s}: {STAGE_DEFS[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <PipelineSteps stage={info.stage} showLabels />
              </div>
            );
          })()}

          <div className="border-t border-border/50 pt-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {isPO(q.document_type) ? (
                <span className="text-sm text-muted-foreground">Work / material order</span>
              ) : (
                <span className="font-display text-lg font-semibold">{formatINR(q.total)}</span>
              )}
              <div className={`grid gap-2 sm:flex sm:items-center ${(isAdmin || isOfficeStaff) ? "grid-cols-2" : "grid-cols-1"}`}>
                <Button size="sm" asChild className="h-10 w-full px-4 sm:w-auto">
                  <Link to={`/admin/quotations/${q.id}`}>Open <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
                {(isAdmin || isOfficeStaff) && (
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
          <h1 className="font-display text-2xl sm:text-3xl">
            {statusFilter.startsWith("stage")
              ? `${stageFilterLabel(statusFilter as StageFilterKey)} Queue`
              : statusFilter === "rejected"
              ? "Rejected Quotations"
              : "Quotations & Purchase Orders"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {statusFilter.startsWith("stage")
              ? `Showing only quotations currently in the ${stageFilterLabel(statusFilter as StageFilterKey)} stage.`
              : "Customer quotations and worker / supplier POs in one place."}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {!isPO(docTab) && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => navigate("/admin/quotations/bulk")}
            >
              <FileText className="mr-2 h-4 w-4" /> Bulk create
            </Button>
          )}
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
                <Label className="flex items-center gap-1.5">
                  {isPO(newDocType) ? "Worker / Supplier name *" : "Customer name *"}
                  <HelpHint id="quotation.party_name" />
                </Label>
                {isPO(newDocType) ? (
                  <AutoSuggestInput<{ phone: string | null; whatsapp_number: string }>
                    value={form.party_name}
                    onChange={(v) => setForm((f) => ({ ...f, party_name: toTitleCase(v) }))}
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
                  <Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: toTitleCase(e.target.value) })} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  {isPO(newDocType) ? "Place (optional)" : "Place *"}
                  <HelpHint id="quotation.party_place" />
                </Label>
                <Input
                  value={form.party_place}
                  onChange={(e) => setForm({ ...form, party_place: e.target.value })}
                  placeholder="e.g. Wayanad"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">Phone <HelpHint id="quotation.party_phone" /></Label>
                <Input inputMode="tel" value={form.party_phone} onChange={(e) => setForm({ ...form, party_phone: e.target.value })} />
              </div>
              {!isPO(newDocType) && (
                <div className="space-y-1.5">
                  <Label>Salesperson / Staff name</Label>
                  <div className="flex gap-2">
                    <SearchableSelect
                      className="flex-1"
                      value={form.salesperson_name}
                      onChange={(v) => setForm((f) => ({ ...f, salesperson_name: v }))}
                      options={salesStaffOptions.map((s) => ({ value: s, label: s }))}
                      placeholder="Defaults to you — pick another to attribute"
                      emptyText="No staff found"
                    />
                    {form.salesperson_name ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setForm((f) => ({ ...f, salesperson_name: "" }))}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to attribute this quotation to yourself.
                  </p>
                </div>
              )}
              {!isPO(newDocType) && (
                <DeliveryRoutePicker
                  place={form.delivery_place}
                  routeId={form.delivery_route_id}
                  onChange={(v) => setForm({ ...form, delivery_place: v.place, delivery_route_id: v.routeId })}
                />
              )}
              {!isPO(newDocType) && (
                <div className="space-y-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    Client Hub Category *
                    <HelpHint id="quotation.lead_type" />
                  </Label>
                  <Select
                    value={form.lead_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, lead_type: v as typeof f.lead_type }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead — stays in Client Hub for follow-up</SelectItem>
                      <SelectItem value="direct_deal">Direct Deal — auto-routes to OPS for pricing</SelectItem>
                      <SelectItem value="consultation">Consultation — stays in Client Hub</SelectItem>
                      <SelectItem value="custom_project">Custom Project (walk-in) — manual measurement entry</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {form.lead_type === "direct_deal" && "Skips measurement — lands in OPS: In-Progress immediately."}
                   {form.lead_type === "custom_project" && "For walk-in / phone customers only. A Dimensions task is auto-assigned to measurement staff. Website-sourced enquiries should be assigned from the Enquiries Inbox instead."}
                    {form.lead_type === "lead" && "New lead. Owner: Sales / Admin in Client Hub."}
                    {form.lead_type === "consultation" && "Consultation. Owner: Sales / Admin in Client Hub."}
                  </p>
                </div>
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
              <div className="w-full sm:w-auto">
                <Button onClick={create} disabled={creating} className="w-full sm:w-auto">{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create & open</Button>
                <ActionHint id="quotation.create" />
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
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
            {STAGE_FILTER_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {stageFilterLabel(k)} ({counts[k] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isOfficeStaff && (
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="sm:w-56">
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.count})
                </SelectItem>
              ))}
              <SelectItem value="__none__">Unknown / system</SelectItem>
            </SelectContent>
          </Select>
        )}
        {isOfficeStaff && (
          <Select value={salesFilter} onValueChange={setSalesFilter}>
            <SelectTrigger className="sm:w-56">
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All salespersons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All salespersons</SelectItem>
              {salesOptions.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name} ({s.count})
                </SelectItem>
              ))}
              <SelectItem value="__none__">No salesperson</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="w-full justify-start overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto">
            {STAGE_FILTER_KEYS.map((k) => (
              <TabsTrigger key={k} value={k} className="whitespace-nowrap">
                {stageFilterLabel(k)} ({counts[k] ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
          {!isPO(docTab) && (statusFilter === "stage1" || leadFilter !== "all") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Client Hub category:
              </span>
              {[
                { v: "all", label: "All" },
                { v: "lead", label: "Leads" },
                { v: "direct_deal", label: "Direct Deals" },
                { v: "consultation", label: "Consultations" },
                { v: "custom_project", label: "Custom Projects" },
              ].map((o) => (
                <Button
                  key={o.v}
                  size="sm"
                  variant={leadFilter === o.v ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setLeadFilter(o.v)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          )}
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
