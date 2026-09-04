import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { toast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

const phoneToEmail = (phone: string) => `${phone.replace(/\D+/g, "")}@workers.local`;
const pinToPassword = (pin: string) => `wkr_${pin.replace(/\D+/g, "")}_pin`;
const isPhoneLike = (s: string) => /^[\d\s+\-()]+$/.test(s.trim()) && s.replace(/\D+/g, "").length >= 8;

const safeNext = (raw: string | null) =>
  raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;

type Mode = "login" | "signup" | "forgot" | "reset";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hash.get("type") || searchParams.get("type");
    if (type === "recovery") setMode("reset");

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => listener.subscription.unsubscribe();
  }, [searchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const email = identifier.trim();
        if (!email || isPhoneLike(email)) throw new Error("Enter your staff email address.");
        const redirectTo = `${window.location.origin}/auth`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
        toast({
          title: "Reset link sent",
          description: "Check your email and open the password reset link.",
        });
        return;
      }

      if (mode === "reset") {
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast({ title: "Password updated", description: "You can now sign in with your new password." });
        await supabase.auth.signOut();
        window.history.replaceState(null, "", "/auth");
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        return;
      }

      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}${next ?? "/admin"}`;
        const { error } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: { emailRedirectTo: redirectUrl, data: { display_name: name } },
        });
        if (error) throw error;
        toast({ title: "Account created", description: "You can now sign in." });
        setMode("login");
      } else {
        const useWorker = isPhoneLike(identifier);
        const creds = useWorker
          ? { email: phoneToEmail(identifier), password: pinToPassword(password) }
          : { email: identifier, password };
        const { error } = await supabase.auth.signInWithPassword(creds);
        if (error) throw error;
        if (next) {
          window.location.href = next;
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
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
      toast({ title: mode === "forgot" ? "Reset failed" : "Auth error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "login" ? "Sign in" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Choose new password";
  const description = mode === "login"
    ? "Staff use email & password. Workers use phone & PIN."
    : mode === "signup"
      ? "First account becomes admin automatically."
      : mode === "forgot"
        ? "Enter your staff email. We’ll send a secure password reset link."
        : "Enter a new password for your account.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex flex-col">
      <header className="container-page py-6">
        <Link to="/"><Logo className="h-10 w-10" /></Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md shadow-elegant border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}

              {mode !== "reset" && (
                <div className="space-y-1.5">
                  <Label htmlFor="identifier">{mode === "login" ? "Email or phone" : "Email"}</Label>
                  <Input
                    id="identifier"
                    type={mode === "login" ? "text" : "email"}
                    inputMode="email"
                    autoComplete={mode === "login" ? "username" : "email"}
                    placeholder={mode === "login" ? "you@example.com or phone" : "you@example.com"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>
              )}

              {(mode === "login" || mode === "signup" || mode === "reset") && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">{mode === "login" && isPhoneLike(identifier) ? "PIN" : mode === "reset" ? "New password" : "Password"}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      inputMode={mode === "login" && isPhoneLike(identifier) ? "numeric" : undefined}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      minLength={mode === "signup" || mode === "reset" ? 6 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "reset" && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
              </Button>
            </form>

            {mode === "login" && !isPhoneLike(identifier) && (
              <button
                type="button"
                onClick={() => { setMode("forgot"); setPassword(""); }}
                className="mt-3 w-full text-center text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            )}

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary"
              >
                Back to sign in
              </button>
            )}

            {(mode === "login" || mode === "signup") && (
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary"
              >
                {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
