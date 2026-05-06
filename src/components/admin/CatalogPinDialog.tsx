import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const CatalogPinDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) => {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [isSet, setIsSet] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setPin(""); setConfirm("");
    supabase.rpc("catalog_pin_is_set").then(({ data }) => setIsSet(!!data));
  }, [open]);

  const save = async () => {
    if (pin.length < 4) return toast({ title: "PIN must be at least 4 characters", variant: "destructive" });
    if (pin !== confirm) return toast({ title: "PINs don't match", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.rpc("set_catalog_pin", { _pin: pin });
    setSaving(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Catalog PIN updated", description: "Share it only with trusted salesmen." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Catalog PIN (Staff Access)</DialogTitle>
          <DialogDescription>
            Salesmen enter this PIN on the public Catalog page to unlock the floor-wise stock view with MRP and full descriptions.
            {isSet !== null && (
              <span className="mt-1 block text-xs">
                Status: <strong>{isSet ? "PIN is set" : "Not configured yet"}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>New PIN</Label>
            <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="At least 4 characters" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm PIN</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSet ? "Update PIN" : "Set PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
