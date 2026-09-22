import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  FileText,
  ShoppingCart,
  Boxes,
  PackageSearch,
  Hammer,
  Truck,
  WalletCards,
  Wrench,
  Users,
  ListTodo,
  BarChart3,
  ArrowRight,
  Loader2,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openEnquiryForm } from "@/lib/enquiryForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Detail = { label: string; value: number | string; tone: "green" | "orange" | "red" | "blue" | "muted" };
type Snapshot = {
  enquiries: number;
  demandItems: number;
  quotations: number;
  orders: number;
  inventory: number;
  purchase: number;
  production: number;
  delivery: number;
  paymentAmount: number;
  services: number;
  customers: number;
  tasks: number;
  details: Record<string, Detail[]>;
};

const EMPTY: Snapshot = {
  enquiries: 0, demandItems: 0, quotations: 0, orders: 0, inventory: 0, purchase: 0,
  production: 0, delivery: 0, paymentAmount: 0, services: 0, customers: 0, tasks: 0,
  details: {},
};

const day = (iso?: string | null) => {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const formatINR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWarehouse, isWorker, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);

  const showAdmin = isAdmin;
  const showOffice = isOfficeStaff;
  const showProduction = isOfficeStaff;
  const showWarehouse = isOfficeStaff || isWarehouse;
  const showDelivery = isOfficeStaff || isDelivery;

  const canCreateEnquiry = isAdmin || isOfficeStaff;
  const canCreateQuotation = isAdmin || isOfficeStaff;
  const canReceiveStock = isAdmin || isOfficeStaff;
  const canCreateService = isAdmin || isOfficeStaff;
  const canCreatePersonalTask =
    isAdmin || isOfficeStaff || isMeasurementStaff || isWarehouse || isDelivery || isWorker;

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [
        qRes,
        itemRes,
        productRes,
        jobRes,
        serviceRes,
        recvRes,
        taskRes,
        followRes,
        stockMoveRes,
        leadRes,
      ] = await Promise.all([
        supabase.from("quotations").select("id,status,pipeline_stage,commercial_status,lead_type,enquiry_contacted_at,next_follow_up_at,created_at,party_phone,expected_delivery_date").is("deleted_at", null),
        supabase.from("quotation_items").select("id,quotation_id,quantity"),
        supabase.from("products").select("id,stock_quantity,reorder_level,created_at").is("deleted_at", null),
        supabase.from("job_work_orders").select("id,status,warehouse_status,job_type,due_at").is("deleted_at", null),
        supabase.from("customer_services").select("id,status,created_at").is("deleted_at", null),
        supabase.from("receivables").select("id,pending_amount,next_follow_up_at,closed_at"),
        supabase.from("staff_diary_notes").select("id,status,due_date,created_at").is("deleted_at", null),
        supabase.from("quotation_followups").select("id,quotation_id,status,scheduled_for"),
        supabase.from("stock_movements").select("id,reason,created_at").eq("reason", "inbound_receive"),
        (supabase as any).from("sales_leads").select("id,status,source,contacted_at,created_at").is("deleted_at", null),
      ]);

      if (cancelled) return;

      const today = todayKey();
      const qs = (qRes.data ?? []) as any[];
      const items = (itemRes.data ?? []) as any[];
      const products = (productRes.data ?? []) as any[];
      const jobs = (jobRes.data ?? []) as any[];
      const services = (serviceRes.data ?? []) as any[];
      const receivables = (recvRes.data ?? []) as any[];
      const tasks = (taskRes.data ?? []) as any[];
      const followups = (followRes.data ?? []) as any[];
      const stockMoves = (stockMoveRes.data ?? []) as any[];
      const leadRows = (leadRes.data ?? []) as any[];
      const openLeads = leadRows.filter(q => ["pending","contacted"].includes(q.status));
      const convertedLeads = leadRows.filter(q => q.status === "converted");
      const cancelledLeads = leadRows.filter(q => ["lost","cancelled"].includes(q.status));
      const onlineLeads = leadRows.filter(q => q.source === "website");
      const manualLeads = leadRows.filter(q => q.source === "manual");
      const demandItems: any[] = [];
      const followDue = followups.filter(f => f.status !== "completed" && day(f.scheduled_for) <= today).length;
      const quoteRows = qs.filter(q => Number(q.pipeline_stage ?? 1) >= 2 && Number(q.pipeline_stage ?? 1) < 3 && !["rejected","delivered"].includes(q.status));
      const confirmed = qs.filter(q => q.commercial_status === "confirmed").length;
      const orders = qs.filter(q => (q.commercial_status === "confirmed" || q.status === "finalized" || Number(q.pipeline_stage ?? 0) >= 3) && !["rejected","delivered"].includes(q.status));
      const deliveryPendingRows = orders.filter(q => !!q.expected_delivery_date);
      const lowStock = products.filter(p => Number(p.stock_quantity ?? 0) > 0 && Number(p.stock_quantity ?? 0) <= Number(p.reorder_level ?? 0)).length;
      const outStock = products.filter(p => Number(p.stock_quantity ?? 0) <= 0).length;
      const openJobs = jobs.filter(j => !["ready","delivered","completed","cancelled"].includes(j.status) && j.warehouse_status !== "dispatched");
      const pendingReceivables = receivables.filter(r => !r.closed_at);
      const paymentAmount = pendingReceivables.reduce((sum, r) => sum + Number(r.pending_amount ?? 0), 0);
      const openServices = services.filter(s => !["resolved","closed","completed"].includes(s.status));
      const pendingTasks = tasks.filter(t => t.status === "pending");

      const phones = qs.map(q => String(q.party_phone ?? "").replace(/\D/g, "")).filter(Boolean);
      const uniquePhones = new Set(phones);
      const phoneCounts = phones.reduce<Record<string, number>>((acc, p) => { acc[p] = (acc[p] ?? 0) + 1; return acc; }, {});
      const repeatCustomers = Object.values(phoneCounts).filter(n => n > 1).length;

      const details: Record<string, Detail[]> = {
        enquiries: [
          { label: "Pending", value: openLeads.length, tone: "orange" },
          { label: "Converted", value: convertedLeads.length, tone: "green" },
          { label: "Cancelled / Lost", value: cancelledLeads.length, tone: "red" },
          { label: "Online / Manual", value: `${onlineLeads.length} / ${manualLeads.length}`, tone: "blue" },
        ],
        demand: [
          { label: "Open Enquiry Items", value: demandItems.length, tone: "orange" },
          { label: "Customers Waiting", value: openLeads.length, tone: "red" },
          { label: "Follow-up Due", value: followDue, tone: "blue" },
        ],
        quotations: [
          { label: "Draft", value: quoteRows.length, tone: "orange" },
          { label: "In Follow-up", value: followups.filter(f => f.status === "pending").length, tone: "blue" },
          { label: "Confirmed", value: confirmed, tone: "green" },
        ],
        orders: [
          { label: "OPS", value: orders.filter(q => Number(q.pipeline_stage) === 3).length, tone: "blue" },
          { label: "Production", value: orders.filter(q => Number(q.pipeline_stage) === 4).length, tone: "orange" },
          { label: "Warehouse", value: orders.filter(q => Number(q.pipeline_stage) === 5).length, tone: "green" },
        ],
        inventory: [
          { label: "Low Stock", value: lowStock, tone: "orange" },
          { label: "Out of Stock", value: outStock, tone: "red" },
          { label: "Inward Today", value: stockMoves.filter(m => day(m.created_at) === today).length, tone: "green" },
        ],
        purchase: [
          { label: "Low Stock", value: lowStock, tone: "orange" },
          { label: "Out of Stock", value: outStock, tone: "red" },
          { label: "Needs Review", value: lowStock + outStock, tone: "blue" },
        ],
        production: [
          { label: "Assigned", value: jobs.filter(j => j.status === "assigned").length, tone: "orange" },
          { label: "In Production", value: jobs.filter(j => ["started","in_progress"].includes(j.status)).length, tone: "blue" },
          { label: "Ready", value: jobs.filter(j => j.status === "ready").length, tone: "green" },
        ],
        delivery: [
          { label: "Due Today", value: deliveryPendingRows.filter(q => day(q.expected_delivery_date) === today).length, tone: "orange" },
          { label: "Overdue", value: deliveryPendingRows.filter(q => day(q.expected_delivery_date) && day(q.expected_delivery_date) < today).length, tone: "red" },
          { label: "Upcoming", value: deliveryPendingRows.filter(q => day(q.expected_delivery_date) > today).length, tone: "green" },
        ],
        payments: [
          { label: "Due Today", value: formatINR(pendingReceivables.filter(r => day(r.next_follow_up_at) === today).reduce((s,r) => s + Number(r.pending_amount ?? 0),0)), tone: "orange" },
          { label: "Overdue", value: formatINR(pendingReceivables.filter(r => r.next_follow_up_at && day(r.next_follow_up_at) < today).reduce((s,r) => s + Number(r.pending_amount ?? 0),0)), tone: "red" },
          { label: "Open Accounts", value: pendingReceivables.length, tone: "blue" },
        ],
        services: [
          { label: "New", value: openServices.filter(s => ["new","pending"].includes(s.status)).length, tone: "green" },
          { label: "Assigned", value: openServices.filter(s => s.status === "assigned").length, tone: "blue" },
          { label: "In Progress", value: openServices.filter(s => ["in_progress","converted"].includes(s.status)).length, tone: "orange" },
        ],
        customers: [
          { label: "Unique Customers", value: uniquePhones.size, tone: "green" },
          { label: "Repeat Customers", value: repeatCustomers, tone: "blue" },
          { label: "Follow-up Pending", value: followDue, tone: "red" },
        ],
        tasks: [
          { label: "Today", value: pendingTasks.filter(t => t.due_date === today).length, tone: "green" },
          { label: "Overdue", value: pendingTasks.filter(t => t.due_date && t.due_date < today).length, tone: "red" },
          { label: "Upcoming", value: pendingTasks.filter(t => t.due_date && t.due_date > today).length, tone: "orange" },
        ],
      };

      setSnapshot({
        enquiries: openLeads.length,
        demandItems: demandItems.length,
        quotations: quoteRows.length,
        orders: orders.length,
        inventory: products.length,
        purchase: lowStock + outStock,
        production: openJobs.length,
        delivery: deliveryPendingRows.length,
        paymentAmount,
        services: openServices.length,
        customers: uniquePhones.size,
        tasks: pendingTasks.length,
        details,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [authLoading, user]);

  if (!authLoading && user && isMeasurementStaff && !isOfficeStaff && !isDelivery) return <Navigate to="/admin/my-work" replace />;

  const cards = useMemo(() => [
    {
      key: "enquiries", title: "Enquiries", count: snapshot.enquiries, href: "/admin/enquiries",
      action: "Open Enquiries", icon: ClipboardList,
      quickAction: canCreateEnquiry ? { label: "New Enquiry", kind: "enquiry" } : undefined,
      show: showOffice || showAdmin,
    },
    {
      key: "quotations", title: "Quotations", count: snapshot.quotations, href: "/admin/quotations",
      action: "Open Quotations", icon: FileText,
      quickAction: canCreateQuotation ? { label: "New Quotation", href: "/admin/quotations?new=1" } : undefined,
      show: showOffice || showAdmin,
    },
    {
      key: "delivery", title: "Delivery", count: snapshot.delivery, href: "/admin/delivery",
      action: "Open Delivery Planner", icon: Truck, show: showDelivery || showOffice || showAdmin,
    },
    {
      key: "payments", title: "Payments", count: formatINR(snapshot.paymentAmount), href: "/admin/backlog",
      action: "View Payments", icon: WalletCards, show: showOffice || showAdmin,
    },
    {
      key: "sales", title: "Sales Analysis", count: snapshot.orders, href: "/admin/salesman-reports",
      action: "Salesman-wise Report", icon: BarChart3,
      customDetails: [
        { label: "Confirmed / Orders", value: snapshot.orders, tone: "green" as const },
        { label: "Pending Payments", value: formatINR(snapshot.paymentAmount), tone: "red" as const },
        { label: "Delivery Pending", value: snapshot.delivery, tone: "orange" as const },
      ],
      show: showOffice || showAdmin,
    },
    {
      key: "production", title: "Work Progress", count: snapshot.production, href: "/admin/worker-reports",
      action: "Open Work Reports", icon: Hammer, show: showProduction || showAdmin,
    },
    {
      key: "tasks", title: "Tasks / Follow-ups", count: snapshot.tasks, href: "/admin/diary",
      action: "View Tasks", icon: ListTodo,
      quickAction: canCreatePersonalTask ? { label: "New Task", href: "/admin/diary?new=1" } : undefined,
      show: true,
    },
  ].filter(c => c.show), [
    snapshot, showOffice, showAdmin, showProduction, showDelivery,
    canCreateEnquiry, canCreateQuotation, canCreatePersonalTask,
  ]);

  const roleTitle = isAdmin ? "Home Dashboard" : isOfficeStaff ? "Sales & Office Dashboard" : isWarehouse ? "Warehouse Dashboard" : isDelivery ? "Delivery Dashboard" : "Work Dashboard";

  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold text-[#2f2925] sm:text-3xl">{roleTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Today's business overview</p>
      </div>

      <div className="mb-5 grid overflow-hidden rounded-2xl border border-[#8b6b4f]/15 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Today Enquiries" value={snapshot.details.enquiries?.[0]?.value ?? 0} loading={loading} />
        <SummaryStat label="Orders" value={snapshot.orders} loading={loading} />
        <SummaryStat label="Deliveries" value={snapshot.delivery} loading={loading} />
        <SummaryStat label="Pending Payments" value={formatINR(snapshot.paymentAmount)} loading={loading} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const quickAction = "quickAction" in card ? card.quickAction : undefined;
          const details = "customDetails" in card && card.customDetails ? card.customDetails : (snapshot.details[card.key] ?? []);
          const openCard = () => navigate(card.href);
          const runQuick = (event: React.MouseEvent) => {
            event.stopPropagation();
            if (!quickAction) return;
            if ("kind" in quickAction && quickAction.kind === "enquiry") return openEnquiryForm({ source: "manual" });
            if ("href" in quickAction && quickAction.href) navigate(quickAction.href);
          };

          return (
            <Card
              key={card.key}
              role="link"
              tabIndex={0}
              onClick={openCard}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(); } }}
              className="group cursor-pointer border-[#8b6b4f]/15 bg-white transition-all hover:-translate-y-0.5 hover:border-[#8b6b4f]/35 hover:shadow-md"
            >
              <CardContent className="flex min-h-[190px] h-full flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b6b4f]/10 text-[#76563f]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <h2 className="text-sm font-semibold text-foreground">{card.title}</h2>
                  <div className="font-display text-2xl font-semibold text-[#2f2925]">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : card.count}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {details.slice(0, 3).map((d) => (
                    <div key={d.label} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <StatusDot tone={d.tone} />
                        {d.label}
                      </span>
                      <span className="font-semibold text-foreground">{loading ? "—" : d.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-3">
                  {quickAction ? (
                    <Button type="button" size="sm" className="h-8 bg-[#76563f] text-xs hover:bg-[#654936]" onClick={runQuick}>
                      <Plus className="mr-1 h-3.5 w-3.5" />{quickAction.label}
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="h-8 border-[#8b6b4f]/25 text-xs text-[#76563f]" onClick={(e) => { e.stopPropagation(); openCard(); }}>
                      {card.action}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
};

const StatusDot = ({ tone }: { tone: Detail["tone"] }) => {
  const cls = tone === "green" ? "bg-emerald-500"
    : tone === "orange" ? "bg-amber-500"
      : tone === "red" ? "bg-red-500"
        : tone === "blue" ? "bg-sky-500"
          : "bg-stone-400";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
};

const SummaryStat = ({ label, value, loading }: { label: string; value: number | string; loading: boolean }) => (
  <div className="border-b border-[#8b6b4f]/10 px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="mt-1 font-display text-2xl font-semibold text-[#2f2925]">
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
    </div>
  </div>
);

export default AdminOverview;
