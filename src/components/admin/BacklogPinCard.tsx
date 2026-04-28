import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

/**
 * Admin-only card to set or change the secondary "Backlog" PIN that gates
 * access to confidential financial data (Receivables).
 */
export function BacklogPinCard() {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("backlog_pin_is_set");
      if (!alive) return;
      setPinSet(!!data);
    })();
    return () => { alive = false; };
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pin.length < 4) { toast({ title: "PIN too short", description: "Minimum 4 characters.", variant: "destructive" }); return; }
    if (pin !== pin2) { toast({ title: "PINs do not match", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("set_backlog_pin", { _pin: pin });
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setPin(""); setPin2(""); setPinSet(true);
    toast({ title: pinSet ? "Backlog PIN updated" : "Backlog PIN set" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Backlog PIN
          {pinSet && <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Active</Badge>}
          {pinSet === false && <Badge variant="outline">Not set</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Secondary PIN that protects the hidden Backlog area (Receivables). Only admins know this PIN. Press <kbd className="rounded border bg-muted px-1">Ctrl/Cmd</kbd>+<kbd className="rounded border bg-muted px-1">Shift</kbd>+<kbd className="rounded border bg-muted px-1">B</kbd> anywhere to open Backlog.
        </p>
        <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">{pinSet ? "New PIN" : "Set PIN"}</Label>
            <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirm</Label>
            <Input type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value)} placeholder="••••" />
          </div>
          <Button type="submit" disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {pinSet ? "Update PIN" : "Save PIN"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
