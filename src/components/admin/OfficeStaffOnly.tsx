import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Route gate that allows admins and office staff. Other roles
 * (warehouse, delivery, measurement, worker) are bounced to /admin.
 */
export const OfficeStaffOnly = ({ children }: { children: ReactNode }) => {
  const { loading, user, isAdmin, isOfficeStaff } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin && !isOfficeStaff) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};