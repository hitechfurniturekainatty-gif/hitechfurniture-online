import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff" | "measurement_staff" | "delivery" | "worker";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async (userId: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      setRoles((data ?? []).map((r) => r.role as AppRole));
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchRoles(session.user.id), 0);
      } else {
        setRoles([]);
        setLoading(false);
        // Auto-lock the Backlog (Receivables) area on sign-out so the
        // 15-minute unlock window doesn't carry over to the next user.
        try { sessionStorage.removeItem("backlog_unlock_until"); } catch { /* ignore */ }
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isMeasurementStaff = roles.includes("measurement_staff");
  const isOfficeStaff = roles.includes("staff") || isAdmin;
  const isDelivery = roles.includes("delivery");
  const isWorker = roles.includes("worker");
  // any authenticated app user (admin/staff/measurement_staff)
  const isStaff = isOfficeStaff || isMeasurementStaff || isDelivery || isWorker;

  return {
    user,
    roles,
    loading,
    isAdmin,
    isOfficeStaff,
    isMeasurementStaff,
    isDelivery,
    isWorker,
    isStaff,
    signOut: () => supabase.auth.signOut(),
  };
}
