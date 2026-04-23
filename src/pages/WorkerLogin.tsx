import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { HardHat, Loader2, Eye, EyeOff } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

const phoneToEmail = (phone: string) => `${phone.replace(/\D+/g, "")}@workers.local`;
const pinToPassword = (pin: string) => `wkr_${pin.replace(/\D+/g, "")}_pin`;

const WorkerLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    // If already signed in as worker → go to portal
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (roles?.some((r) => r.role === "worker")) navigate("/worker", { replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D+/g, "");
    const cleanPin = pin.replace(/\D+/g, "");
    if (cleanPhone.length < 8) {
      toast({ title: "Enter your full phone number", variant: "destructive" });
      return;
    }
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      toast({ title: "PIN must be 4–6 digits", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(cleanPhone),
      password: pinToPassword(cleanPin),
    });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: "Wrong phone or PIN. Contact office.", variant: "destructive" });
      return;
    }
    navigate("/worker", { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/30">
      <header className="border-b border-border bg-background/95 px-4 py-3">
        <Link to="/" className="font-display text-lg">{BRAND_NAME}</Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <HardHat className="h-7 w-7 text-primary" />
              </div>
              <h1 className="mt-3 font-display text-2xl">Worker login</h1>
              <p className="mt-1 text-sm text-muted-foreground">View your assigned jobs and update status.</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9526610404"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pin">PIN</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    autoComplete="current-password"
                    placeholder="4–6 digits"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              Forgot your PIN? Ask the office to reset it for you.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default WorkerLogin;