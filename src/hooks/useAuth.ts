import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer role fetch
        setTimeout(() => {
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .then(({ data }) => setRoles((data ?? []).map((r) => r.role as AppRole)));
        }, 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .then(({ data }) => setRoles((data ?? []).map((r) => r.role as AppRole)));
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return {
    user,
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    isStaff: roles.includes("staff") || roles.includes("admin"),
    signOut: () => supabase.auth.signOut(),
  };
}
