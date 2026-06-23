import { NavLink } from "react-router-dom";
import { Users, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared tab strip rendered above AdminStaff and AdminWorkers so admins can
 * switch between Office Staff and the Production Unit without leaving the
 * "People" surface. Each tab navigates to the canonical route for that view.
 */
export const PeopleTabs = () => {
  const tab = (to: string, label: string, Icon: any) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-smooth",
          isActive
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      <Icon className="h-4 w-4" /> {label}
    </NavLink>
  );
  return (
    <div className="mb-4 inline-flex w-full rounded-lg bg-muted p-1 sm:w-auto">
      {tab("/admin/staff", "Office Staff", Users)}
      {tab("/admin/workers", "Production Unit", HardHat)}
    </div>
  );
};