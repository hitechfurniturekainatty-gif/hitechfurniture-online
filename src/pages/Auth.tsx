import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { toast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

// Worker logins are stored as synthetic email/password derived from phone + PIN.
// Mirrors the mapping used in src/pages/WorkerLogin.tsx and the worker-create-login edge fn.
const phoneToEmail = (phone: string) => `${phone.replace(/\D+/g, "")}@workers.local`;
const pinToPassword = (pin: string) => `wkr_${pin.replace(/\D+/g, "")}_pin`;
const isPhoneLike = (s: string) => /^[\d\s+\-()]+$/.test(s.trim()) && s.replace(/\D+/g, "").length >= 8;

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/admin`;
        const { error } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: { emailRedirectTo: redirectUrl, data: { display_name: name } },
        });
        if (error) throw error;
        toast({ title: "Account created", description: "You can now sign in." });
        setMode("login");
      } else {
        // Phone (digits) → worker login flow; otherwise → standard email login.
        const useWorker = isPhoneLike(identifier);
        const creds = useWorker
          ? { email: phoneToEmail(identifier), password: pinToPassword(password) }
          : { email: identifier, password };
        const { error } = await supabase.auth.signInWithPassword(creds);
        if (error) throw error;
        // Role-aware redirect: fetch user's roles and route accordingly
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        // Resolve a friendly display name for the welcome toast
        let displayName =
          (userData.user?.user_metadata as any)?.display_name ||
          userData.user?.email?.split("@")[0] ||
          "there";
        if (uid) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", uid)
            .maybeSingle();
          if (profile?.display_name) displayName = profile.display_name;
          toast({ title: `Hi ${displayName}`, description: "Welcome to My Hitech 👋" });
          const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", uid);
          const roles = (rolesData ?? []).map((r) => r.role as string);
          const isAdmin = roles.includes("admin");
          const isOffice = roles.includes("staff") || isAdmin;
          const isWorker = roles.includes("worker");
          // Workers have a dedicated portal — never enter the admin shell.
          if (isWorker && !isOffice && !isAdmin) navigate("/worker");
          else if (isAdmin) navigate("/admin");
          else if (isOffice) navigate("/admin/my-work");
          else if (roles.includes("measurement_staff")) navigate("/admin/my-work");
          else if (roles.includes("delivery")) navigate("/admin/my-trips");
          else navigate("/admin");
        } else {
          toast({ title: `Hi ${displayName}`, description: "Welcome to My Hitech 👋" });
          navigate("/admin");
        }
      }
    } catch (err: any) {
      toast({ title: "Auth error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex flex-col">
      <header className="container-page py-6">
        <Link to="/"><Logo className="h-10 w-auto" /></Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md shadow-elegant border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {mode === "login" ? "Staff sign in" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Access the catalog dashboard."
                : "First account becomes admin automatically."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary"
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
