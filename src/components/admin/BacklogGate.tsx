import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, KeyRound, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const SS_KEY = "backlog_unlock_until";
const UNLOCK_MS = 15 * 60 * 1000; // 15 minutes

export function isBacklogUnlocked(): boolean {
  try {
    const v = sessionStorage.getItem(SS_KEY);
    if (!v) return false;
    return Number(v) > Date.now();
  } catch {
    return false;
  }
}

function unlockNow() {
  try {
    sessionStorage.setItem(SS_KEY, String(Date.now() + UNLOCK_MS));
  } catch {
    /* ignore */
  }
}

export function lockBacklog() {
  try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
}

/**
 * Wraps confidential admin content (Receivables) and gates it behind a PIN.
 * - Admin-only (silently 404 for non-admins)
 * - 30-minute session unlock after correct PIN
 * - First-time setup flow if no PIN has been configured yet
 */
export function BacklogGate({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState<boolean>(() => isBacklogUnlocked());
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("backlog_pin_is_set");
      if (!alive) return;
      if (error) { setPinSet(false); return; }
      setPinSet(!!data);
    })();
    return () => { alive = false; };
  }, [isAdmin]);

  if (authLoading || (isAdmin && pinSet === null && !unlocked)) {
    return (
      <AdminShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  // Hide existence from non-admins entirely.
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-display text-3xl">404</h1>
        <p className="text-sm text-muted-foreground">The page you are looking for does not exist.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!pin.trim()) {
      toast({ title: "Enter PIN", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (pinSet === false) {
        // First-time setup
        if (pin.length < 4) {
          toast({ title: "PIN too short", description: "Minimum 4 characters.", variant: "destructive" });
          return;
        }
        if (pin !== pin2) {
          toast({ title: "PINs do not match", variant: "destructive" });
          return;
        }
        const { error } = await supabase.rpc("set_backlog_pin", { _pin: pin });
        if (error) throw error;
        unlockNow();
        setUnlocked(true);
        toast({ title: "Backlog PIN set", description: "Unlocked for 30 minutes." });
      } else {
        const { data, error } = await supabase.rpc("verify_backlog_pin", { _pin: pin });
        if (error) throw error;
        if (!data) {
          toast({ title: "Incorrect PIN", variant: "destructive" });
          return;
        }
        unlockNow();
        setUnlocked(true);
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
      setPin("");
      setPin2("");
    }
  };

  return (
    <AdminShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-7 w-7" />
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Backlog · Restricted Area
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pinSet === false && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>No PIN is set yet. Create a secondary PIN now to protect the Backlog area. You can change it later in Staff Management.</span>
              </div>
            )}
            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder={pinSet === false ? "New PIN (min 4)" : "Enter PIN"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center tracking-widest"
              />
              {pinSet === false && (
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Confirm PIN"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value)}
                  className="text-center tracking-widest"
                />
              )}
              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {pinSet === false ? "Set PIN & unlock" : "Unlock"}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Unlocked for 15 minutes after correct PIN. Auto-locks on sign-out.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
