import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Boxes, ClipboardList, FileText, IndianRupee, Inbox, Ruler, Sofa, Truck, Warehouse } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function FurnitureWorkflowLauncher(){
  const { isAdmin } = useAuth();
  const steps = [
    { to: "/admin/enquiries", label: "Enquiry", sub: "New showroom / website lead", icon: Inbox },
    { to: "/admin/quotations", label: "Quotation", sub: "Ready stock or custom order", icon: FileText },
    { to: "/admin/measurement-tasks", label: "Measurement", sub: "Site dimensions & photos", icon: Ruler },
    { to: "/admin/production", label: "Production", sub: "Custom furniture work", icon: Sofa },
    { to: "/admin/warehouse", label: "Warehouse", sub: "Ready to dispatch", icon: Warehouse },
    { to: "/admin/logistics", label: "Delivery", sub: "Route & trip planning", icon: Truck },
    ...(isAdmin ? [{ to: "/admin/backlog", label: "Receivables", sub: "Balance to receive", icon: IndianRupee }] : []),
  ];
  const quick = [
    { to: "/admin/quotations", label: "Quotations & Orders", icon: ClipboardList },
    { to: "/admin/quotations?lead=custom_project", label: "Custom Projects", icon: Sofa },
    { to: "/admin/products", label: "Products", icon: Boxes },
    { to: "/admin/warehouse", label: "Dispatch Queue", icon: Warehouse },
  ];

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><h2 className="font-display text-xl font-semibold sm:text-2xl">Furniture Shop Workflow</h2><Badge variant="secondary">One-click</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">From customer enquiry to final collection — open the exact stage without searching menus.</p>
      </div>
      <div className="flex flex-wrap gap-2">{quick.map(q=><Link key={q.to} to={q.to} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-sm transition hover:bg-muted"><q.icon className="h-4 w-4"/>{q.label}</Link>)}</div>
    </div>
    <Card className="overflow-hidden"><CardContent className="p-3 sm:p-4"><div className={`grid gap-2 sm:grid-cols-2 ${isAdmin?"xl:grid-cols-7":"xl:grid-cols-6"}`}>{steps.map((s,i)=><Link key={s.label} to={s.to} className="group relative rounded-xl border bg-background p-3 transition hover:border-primary/40 hover:bg-primary/5"><div className="mb-2 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><s.icon className="h-4 w-4"/></span><span className="text-[10px] font-semibold text-muted-foreground">{i+1}</span></div><p className="text-sm font-semibold">{s.label}</p><p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{s.sub}</p>{i<steps.length-1&&<ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground xl:block"/>}</Link>)}</div></CardContent></Card>
  </section>;
}
