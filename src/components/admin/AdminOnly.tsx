import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Route gate for admin-only pages. Office staff and other roles are
 * redirected to /admin (Overview). Prevents direct-URL access to
 * Home Page editor, Staff Management, Products/Categories, Routes, Trash.
 */
export const AdminOnly = ({ children }: { children: ReactNode }) => {
  const { loading, user, isAdmin } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};