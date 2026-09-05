import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BriefcaseBusiness, FileText, IndianRupee, Inbox, MapPinned, PackageCheck, Ruler, Truck, Warehouse } from "lucide-react";

type RoleFocusPanelProps = {
  isAdmin: boolean;
  isOfficeStaff: boolean;
  isWarehouse: boolean;
  isDelivery: boolean;
};

type Action = {
  label: string;
  sub: string;
  to: string;
  icon: typeof FileText;
};

const adminActions: Action[] = [
  { label: "Sales & Orders", sub: "Leads, quotations and confirmed orders", to: "/admin/quotations", icon: FileText },
  { label: "Production", sub: "Custom jobs and worker follow-up", to: "/admin/production", icon: BriefcaseBusiness },
  { label: "Warehouse", sub: "Ready stock and dispatch queue", to: "/admin/warehouse", icon: Warehouse },
  { label: "Delivery", sub: "Routes, trips and delivery readiness", to: "/admin/logistics", icon: Truck },
  { label: "Receivables", sub: "Customer balances and promise dates", to: "/admin/backlog", icon: IndianRupee },
];

const officeActions: Action[] = [
  { label: "Enquiries", sub: "New customer leads and inbox", to: "/admin/enquiries", icon: Inbox },
  { label: "Quotations", sub: "Prepare, follow up and confirm", to: "/admin/quotations", icon: FileText },
  { label: "Measurements", sub: "Site visits, dimensions and photos", to: "/admin/measurement-tasks", icon: Ruler },
  { label: "Production", sub: "Custom-order work progress", to: "/admin/production", icon: BriefcaseBusiness },
];

const warehouseActions: Action[] = [
  { label: "Warehouse Queue", sub: "Pick, pack and dispatch-ready orders", to: "/admin/warehouse", icon: PackageCheck },
  { label: "Delivery Planning", sub: "Check route and trip readiness", to: "/admin/logistics", icon: MapPinned },
];

const deliveryActions: Action[] = [
  { label: "My Trips", sub: "Today's deliveries, customer details and balance to collect", to: "/admin/my-trips", icon: Truck },
  { label: "Route View", sub: "Route and delivery planning", to: "/admin/logistics", icon: MapPinned },
];

export function RoleFocusPanel({ isAdmin, isOfficeStaff, isWarehouse, isDelivery }: RoleFocusPanelProps) {
  const actions = isAdmin
    ? adminActions
    : isOfficeStaff
      ? officeActions
      : isWarehouse
        ? warehouseActions
        : isDelivery
          ? deliveryActions
          : [];

  if (!actions.length) return null;

  const roleLabel = isAdmin ? "Admin" : isOfficeStaff ? "Sales / Office" : isWarehouse ? "Warehouse" : "Delivery";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold sm:text-xl">My Focus</h2>
        <Badge variant="outline" className="font-normal">{roleLabel}</Badge>
      </div>
      <div className={`grid gap-2 ${actions.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}>
        {actions.map((a) => (
          <Link key={a.label} to={a.to} className="group">
            <Card className="h-full border-border/80 bg-card transition hover:border-primary/30 hover:shadow-sm">
              <CardContent className="flex items-start gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <a.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{a.sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
