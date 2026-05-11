import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { HelpDrawer } from "./HelpDrawer";
import type { AppRole } from "@/hooks/useAuth";

/**
 * Floating Help button — bottom-right on every admin page.
 * Opens a role-aware user manual.
 */
export const HelpFab = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWorker } = useAuth();
  const [open, setOpen] = useState(false);

  const role: AppRole = isAdmin
    ? "admin"
    : isOfficeStaff
    ? "staff"
    : isMeasurementStaff
    ? "measurement_staff"
    : isDelivery
    ? "delivery"
    : isWorker
    ? "worker"
    : "staff";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-product transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40 sm:bottom-6 sm:right-6"
      >
        <LifeBuoy className="h-5 w-5" />
        <span className="sr-only">Help</span>
      </button>
      <HelpDrawer open={open} onOpenChange={setOpen} role={role} allowRoleSwitch={isAdmin} />
    </>
  );
};

export default HelpFab;