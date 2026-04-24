import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Wrench,
  AlertTriangle,
  Search,
  FileText,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ContactPicker } from "@/components/admin/ContactPicker";
import { DeliveryRoutePicker } from "@/components/logistics/DeliveryRoutePicker";
import {
  COMPLAINT_STATUSES,
  SERVICE_STATUSES,
  complaintStatusLabel,
  serviceStatusLabel,
  statusVariant,
} from "@/lib/serviceHub";

type ServiceRow = {
  id: string;
  service_code: string;
  customer_name: string;
  customer_place: string;
  customer_phone: string | null;
  item_description: string;
  estimated_cost: number;
  status: string;
  created_at: string;
  quotation_id: string | null;
};

type ComplaintRow = {
  id: string;
  complaint_code: string;
  customer_name: string;
  customer_place: string;
  customer_phone: string | null;
  issue_description: string;
  paid_parts_amount: number;
  status: string;
  created_at: string;
  service_quotation_id: string | null;
  original_quotation_code: string | null;
};

type Tab = "service" | "complaint";

const AdminServices = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) === "complaint" ? "complaint" : "service";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create dialogs
  const [svcOpen, setSvcOpen] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [svcForm, setSvcForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_place: "",
    customer_address: "",
    item_description: "",
    work_needed: "",
    estimated_cost: "",
    delivery_route_id: null as string | null,
  });

  const [cpForm, setCpForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_place: "",
    customer_address: "",
    original_quotation_code: "",
    issue_description: "",
    delivery_route_id: null as string | null,
  });

  const load = async () => {
    setLoading(true);
    const [svcRes, cpRes] = await Promise.all([
      supabase
        .from("customer_services")
        .select(
          "id, service_code, customer_name, customer_place, customer_phone, item_description, estimated_cost, status, created_at, quotation_id",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_complaints")
        .select(
          "id, complaint_code, customer_name, customer_place, customer_phone, issue_description, paid_parts_amount, status, created_at, service_quotation_id, original_quotation_code",
        )
        .order("created_at", { ascending: false }),
    ]);
    setServices((svcRes.data ?? []) as ServiceRow[]);
    setComplaints((cpRes.data ?? []) as ComplaintRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Sync tab into URL so deep links work
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
    setStatusFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const createService = async () => {
    if (!svcForm.customer_name.trim() || !svcForm.customer_phone.trim()) {
      toast({
        title: "Missing details",
        description: "Customer name and phone are required.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    const placeFinal = svcForm.customer_place.trim() || "NA";
    const itemFinal = svcForm.item_description.trim() || "Service request";
    const { data: codeData, error: codeErr } = await supabase.rpc("next_service_id" as any);
    if (codeErr || !codeData) {
      setCreating(false);
      toast({ title: "Failed to generate ID", description: codeErr?.message, variant: "destructive" });
      return;
    }
    // 1) Insert the customer_services row
    const { data, error } = await supabase
      .from("customer_services")
      .insert({
        service_code: codeData as string,
        customer_name: svcForm.customer_name.trim(),
        customer_phone: svcForm.customer_phone.trim() || null,
        customer_place: placeFinal,
        customer_address: svcForm.customer_address.trim() || null,
        item_description: itemFinal,
        work_needed: svcForm.work_needed.trim() || null,
        estimated_cost: Number(svcForm.estimated_cost) || 0,
        delivery_route_id: svcForm.delivery_route_id,
        delivery_place: placeFinal,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setCreating(false);
      toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      return;
    }
    // 2) Auto-generate a linked Service Quotation (QT-XXX) so admin can edit pricing/photos right away
    const { data: qid, error: qidErr } = await supabase.rpc("next_quotation_id" as any, {
      _party: svcForm.customer_name.trim(),
      _place: placeFinal,
    });
    if (!qidErr && qid) {
      const { data: qData } = await supabase
        .from("quotations")
        .insert({
          quotation_id: qid as string,
          party_name: svcForm.customer_name.trim(),
          party_place: placeFinal,
          party_phone: svcForm.customer_phone.trim() || null,
          party_address: svcForm.customer_address.trim() || null,
          delivery_place: placeFinal,
          delivery_route_id: svcForm.delivery_route_id,
          document_type: "quotation",
          service_type: "service",
          source_service_id: data.id,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (qData) {
        await supabase.from("quotation_items").insert({
          quotation_id: qData.id,
          description: `${itemFinal}${svcForm.work_needed.trim() ? ` — ${svcForm.work_needed.trim()}` : ""}`,
          quantity: 1,
          unit_price: Number(svcForm.estimated_cost) || 0,
          display_order: 0,
        });
        await supabase
          .from("customer_services")
          .update({ quotation_id: qData.id, status: "converted" })
          .eq("id", data.id);
      }
    }
    setCreating(false);
    setSvcOpen(false);
    setSvcForm({
      customer_name: "",
      customer_phone: "",
      customer_place: "",
      customer_address: "",
      item_description: "",
      work_needed: "",
      estimated_cost: "",
      delivery_route_id: null,
    });
    toast({
      title: "Service created",
      description: `${codeData as string} — Service Quotation auto-generated. Open it to add product photo & price.`,
    });
    load();
  };

  const createComplaint = async () => {
    if (!cpForm.customer_name.trim() || !cpForm.customer_phone.trim()) {
      toast({
        title: "Missing details",
        description: "Customer name and phone are required.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    const placeFinal = cpForm.customer_place.trim() || "NA";
    const issueFinal = cpForm.issue_description.trim() || "Complaint logged";
    const { data: codeData, error: codeErr } = await supabase.rpc("next_complaint_id" as any);
    if (codeErr || !codeData) {
      setCreating(false);
      toast({ title: "Failed to generate ID", description: codeErr?.message, variant: "destructive" });
      return;
    }
    // Optional: try to link to an existing quotation by its visible quotation_id text
    let originalId: string | null = null;
    if (cpForm.original_quotation_code.trim()) {
      const { data: qLookup } = await supabase
        .from("quotations")
        .select("id")
        .eq("quotation_id", cpForm.original_quotation_code.trim())
        .maybeSingle();
      originalId = qLookup?.id ?? null;
    }
    const { data, error } = await supabase
      .from("customer_complaints")
      .insert({
        complaint_code: codeData as string,
        customer_name: cpForm.customer_name.trim(),
        customer_phone: cpForm.customer_phone.trim() || null,
        customer_place: placeFinal,
        customer_address: cpForm.customer_address.trim() || null,
        original_quotation_id: originalId,
        original_quotation_code: cpForm.original_quotation_code.trim() || null,
        issue_description: issueFinal,
        delivery_route_id: cpForm.delivery_route_id,
        delivery_place: placeFinal,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Create failed", description: error?.message, variant: "destructive" });
      return;
    }
    setCpOpen(false);
    setCpForm({
      customer_name: "",
      customer_phone: "",
      customer_place: "",
      customer_address: "",
      original_quotation_code: "",
      issue_description: "",
      delivery_route_id: null,
    });
    toast({ title: "Complaint logged", description: codeData as string });
    load();
  };

  const removeService = async (row: ServiceRow) => {
    if (!confirm(`Move ${row.service_code} to Trash? You can restore it for 30 days.`)) return;
    const { softDelete } = await import("@/lib/softDelete");
    const { error } = await softDelete("customer_services", row.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      setServices((prev) => prev.filter((r) => r.id !== row.id));
      toast({ title: "Moved to Trash" });
      load();
    }
  };

  const removeComplaint = async (row: ComplaintRow) => {
    if (!confirm(`Move ${row.complaint_code} to Trash? You can restore it for 30 days.`)) return;
    const { softDelete } = await import("@/lib/softDelete");
    const { error } = await softDelete("customer_complaints", row.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      setComplaints((prev) => prev.filter((r) => r.id !== row.id));
      toast({ title: "Moved to Trash" });
      load();
    }
  };

  const filteredServices = useMemo(() => {
    const s = search.toLowerCase();
    return services.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!s) return true;
      return (
        r.service_code.toLowerCase().includes(s) ||
        r.customer_name.toLowerCase().includes(s) ||
        r.customer_place.toLowerCase().includes(s) ||
        r.item_description.toLowerCase().includes(s)
      );
    });
  }, [services, search, statusFilter]);

  const filteredComplaints = useMemo(() => {
    const s = search.toLowerCase();
    return complaints.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!s) return true;
      return (
        r.complaint_code.toLowerCase().includes(s) ||
        r.customer_name.toLowerCase().includes(s) ||
        r.customer_place.toLowerCase().includes(s) ||
        r.issue_description.toLowerCase().includes(s) ||
        (r.original_quotation_code ?? "").toLowerCase().includes(s)
      );
    });
  }, [complaints, search, statusFilter]);

  const renderServiceRow = (r: ServiceRow) => (
    <Card key={r.id} className="transition-smooth hover:shadow-product">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-primary">{r.service_code}</span>
            <Badge variant={statusVariant(r.status)} className="text-[10px] capitalize">
              {serviceStatusLabel(r.status)}
            </Badge>
            {r.quotation_id && (
              <Badge variant="default" className="bg-emerald-600 text-[10px] hover:bg-emerald-700">
                <FileText className="mr-1 h-3 w-3" /> Linked QT
              </Badge>
            )}
          </div>
          <p className="mt-1.5 truncate font-semibold">{r.customer_name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />{r.customer_place}
            {r.customer_phone && (
              <><span className="mx-1">•</span><Phone className="h-3 w-3" />{r.customer_phone}</>
            )}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{r.item_description}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {new Date(r.created_at).toLocaleDateString()} • Est. ₹{Number(r.estimated_cost ?? 0).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link to={`/admin/services/${r.id}`}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
          {isAdmin && (
            <Button size="icon" variant="ghost" onClick={() => removeService(r)} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderComplaintRow = (r: ComplaintRow) => (
    <Card key={r.id} className="transition-smooth hover:shadow-product">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-amber-600 dark:text-amber-400">{r.complaint_code}</span>
            <Badge variant={statusVariant(r.status)} className="text-[10px] capitalize">
              {complaintStatusLabel(r.status)}
            </Badge>
            {r.original_quotation_code && (
              <Badge variant="outline" className="text-[10px]">Re: {r.original_quotation_code}</Badge>
            )}
            {r.service_quotation_id && (
              <Badge variant="default" className="bg-emerald-600 text-[10px] hover:bg-emerald-700">
                <FileText className="mr-1 h-3 w-3" /> Service QT
              </Badge>
            )}
          </div>
          <p className="mt-1.5 truncate font-semibold">{r.customer_name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />{r.customer_place}
            {r.customer_phone && (
              <><span className="mx-1">•</span><Phone className="h-3 w-3" />{r.customer_phone}</>
            )}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{r.issue_description}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {new Date(r.created_at).toLocaleDateString()}
            {Number(r.paid_parts_amount) > 0 && (
              <> • Paid parts: ₹{Number(r.paid_parts_amount).toLocaleString("en-IN")}</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link to={`/admin/complaints/${r.id}`}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
          {isAdmin && (
            <Button size="icon" variant="ghost" onClick={() => removeComplaint(r)} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Service & Complaint Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer service requests and warranty complaints in one place.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="service" className="gap-1.5">
            <Wrench className="h-4 w-4" /> Customer Service ({services.length})
          </TabsTrigger>
          <TabsTrigger value="complaint" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Customer Complaint ({complaints.length})
          </TabsTrigger>
        </TabsList>

        {/* Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "service" ? "Search SV code, customer, place, item…" : "Search CP code, customer, issue…"}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(tab === "service" ? SERVICE_STATUSES : COMPLAINT_STATUSES).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {tab === "service" ? serviceStatusLabel(s) : complaintStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {tab === "service" ? (
            <Dialog open={svcOpen} onOpenChange={setSvcOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1 h-4 w-4" /> New Service</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Customer Service</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <ContactPicker
                      onPick={(c) =>
                        setSvcForm((f) => ({
                          ...f,
                          customer_name: c.name || f.customer_name,
                          customer_phone: c.tel || f.customer_phone,
                          customer_place: c.place || f.customer_place,
                          customer_address: c.address || f.customer_address,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Customer Name *</Label>
                      <Input value={svcForm.customer_name} onChange={(e) => setSvcForm({ ...svcForm, customer_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={svcForm.customer_phone} onChange={(e) => setSvcForm({ ...svcForm, customer_phone: e.target.value })} />
                    </div>
                  </div>
                  <DeliveryRoutePicker
                    place={svcForm.customer_place}
                    routeId={svcForm.delivery_route_id}
                    onChange={(next) => setSvcForm({ ...svcForm, customer_place: next.place, delivery_route_id: next.routeId })}
                    label="Customer Place / Route"
                  />
                  <div>
                    <Label>Address</Label>
                    <Textarea rows={2} value={svcForm.customer_address} onChange={(e) => setSvcForm({ ...svcForm, customer_address: e.target.value })} />
                  </div>
                  <div>
                    <Label>Item / Product</Label>
                    <Input
                      value={svcForm.item_description}
                      onChange={(e) => setSvcForm({ ...svcForm, item_description: e.target.value })}
                      placeholder="e.g. 5-seater leather sofa"
                    />
                  </div>
                  <div>
                    <Label>Work Needed</Label>
                    <Textarea
                      rows={2}
                      value={svcForm.work_needed}
                      onChange={(e) => setSvcForm({ ...svcForm, work_needed: e.target.value })}
                      placeholder="e.g. reupholstery, polish, foam replacement"
                    />
                  </div>
                  <div>
                    <Label>Estimated Cost (₹)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={svcForm.estimated_cost}
                      onChange={(e) => setSvcForm({ ...svcForm, estimated_cost: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setSvcOpen(false)}>Cancel</Button>
                  <Button onClick={createService} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Service
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={cpOpen} onOpenChange={setCpOpen}>
              <DialogTrigger asChild>
                <Button variant="default"><Plus className="mr-1 h-4 w-4" /> New Complaint</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Customer Complaint</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <ContactPicker
                      onPick={(c) =>
                        setCpForm((f) => ({
                          ...f,
                          customer_name: c.name || f.customer_name,
                          customer_phone: c.tel || f.customer_phone,
                          customer_place: c.place || f.customer_place,
                          customer_address: c.address || f.customer_address,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Customer Name *</Label>
                      <Input value={cpForm.customer_name} onChange={(e) => setCpForm({ ...cpForm, customer_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={cpForm.customer_phone} onChange={(e) => setCpForm({ ...cpForm, customer_phone: e.target.value })} />
                    </div>
                  </div>
                  <DeliveryRoutePicker
                    place={cpForm.customer_place}
                    routeId={cpForm.delivery_route_id}
                    onChange={(next) => setCpForm({ ...cpForm, customer_place: next.place, delivery_route_id: next.routeId })}
                    label="Customer Place / Route"
                  />
                  <div>
                    <Label>Address</Label>
                    <Textarea rows={2} value={cpForm.customer_address} onChange={(e) => setCpForm({ ...cpForm, customer_address: e.target.value })} />
                  </div>
                  <div>
                    <Label>Original Quotation / Invoice ID</Label>
                    <Input
                      value={cpForm.original_quotation_code}
                      onChange={(e) => setCpForm({ ...cpForm, original_quotation_code: e.target.value })}
                      placeholder="e.g. 2026/27-024 / Rahul / Kalpetta"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      We'll auto-link if it matches an existing quotation.
                    </p>
                  </div>
                  <div>
                    <Label>Issue Description</Label>
                    <Textarea
                      rows={3}
                      value={cpForm.issue_description}
                      onChange={(e) => setCpForm({ ...cpForm, issue_description: e.target.value })}
                      placeholder="Describe the problem the customer is facing"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCpOpen(false)}>Cancel</Button>
                  <Button onClick={createComplaint} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Log Complaint
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <TabsContent value="service" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredServices.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No service requests yet. Click "New Service" to add one.
            </p>
          ) : (
            <div className="grid gap-3">{filteredServices.map(renderServiceRow)}</div>
          )}
        </TabsContent>
        <TabsContent value="complaint" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredComplaints.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No complaints logged yet. Click "New Complaint" to add one.
            </p>
          ) : (
            <div className="grid gap-3">{filteredComplaints.map(renderComplaintRow)}</div>
          )}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
};

export default AdminServices;