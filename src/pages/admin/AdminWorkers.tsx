import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Trash2, Pencil, MessageCircle, HardHat, ListChecks, KeyRound, Copy, Check } from "lucide-react";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";
import { Link } from "react-router-dom";

type Worker = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp_number: string;
  trade: string | null;
  notes: string | null;
  is_active: boolean;
  user_id: string | null;
  login_phone: string | null;
};

const empty = {
  name: "",
  phone: "",
  whatsapp_number: "",
  trade: "",
  notes: "",
  is_active: true,
  login_phone: "",
  login_pin: "",
};

const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));

const AdminWorkers = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loginWorker, setLoginWorker] = useState<Worker | null>(null);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginSaving, setLoginSaving] = useState(false);
  const [lastCreds, setLastCreds] = useState<{ phone: string; pin: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("workers").select("*").is("deleted_at", null).order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    else setRows(data as Worker[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing(null);
    setForm({ ...empty, login_pin: randomPin() });
    setOpen(true);
  };
  const startEdit = (w: Worker) => {
    setEditing(w);
    setForm({
      name: w.name,
      phone: w.phone ?? "",
      whatsapp_number: w.whatsapp_number,
      trade: w.trade ?? "",
      notes: w.notes ?? "",
      is_active: w.is_active,
      login_phone: (w.login_phone || w.whatsapp_number || "").replace(/\D+/g, ""),
      login_pin: "", // never show old PIN; blank = keep existing
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.whatsapp_number.trim()) {
      toast({ title: "Name and WhatsApp number required", variant: "destructive" });
      return;
    }
    const cleanLoginPhone = (form.login_phone || form.whatsapp_number).replace(/\D+/g, "");
    const cleanLoginPin = form.login_pin.replace(/\D+/g, "");
    // For NEW worker: PIN is required (default suggested). For edit: PIN optional (blank = keep).
    if (!editing) {
      if (cleanLoginPhone.length < 8) {
        toast({ title: "Login phone must include country code (8+ digits)", variant: "destructive" });
        return;
      }
      if (cleanLoginPin.length < 4 || cleanLoginPin.length > 6) {
        toast({ title: "Login PIN must be 4–6 digits", variant: "destructive" });
        return;
      }
    } else if (cleanLoginPin && (cleanLoginPin.length < 4 || cleanLoginPin.length > 6)) {
      toast({ title: "PIN must be 4–6 digits (or leave blank to keep current)", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      whatsapp_number: form.whatsapp_number.trim(),
      trade: form.trade.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    let workerId = editing?.id ?? null;
    if (editing) {
      const { error } = await supabase.from("workers").update(payload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { data, error } = await supabase.from("workers").insert(payload).select("id").single();
      if (error || !data) {
        setSaving(false);
        toast({ title: "Save failed", description: error?.message || "Insert failed", variant: "destructive" });
        return;
      }
      workerId = data.id;
    }

    // Provision / update login if PIN was provided (always for new, optional for edit)
    let createdCreds: { phone: string; pin: string; name: string } | null = null;
    if (workerId && cleanLoginPin) {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("worker-create-login", {
        body: { worker_id: workerId, phone: cleanLoginPhone, pin: cleanLoginPin },
      });
      if (fnErr || (fnData as any)?.error) {
        setSaving(false);
        toast({
          title: "Worker saved, but login setup failed",
          description: (fnData as any)?.error || fnErr?.message || "Try again from the key icon",
          variant: "destructive",
        });
        setOpen(false);
        load();
        return;
      }
      createdCreds = { phone: cleanLoginPhone, pin: cleanLoginPin, name: form.name.trim() };
    }

    setSaving(false);
    toast({ title: editing ? "Worker updated" : "Worker added" });
    setOpen(false);
    load();

    // For NEW worker show credentials popup so admin can copy / WhatsApp them
    if (!editing && createdCreds) {
      setLoginWorker({ id: workerId!, name: createdCreds.name } as Worker);
      setLoginPhone(createdCreds.phone);
      setLoginPin(createdCreds.pin);
      setLastCreds(createdCreds);
      setCopied(false);
    }
  };

  const remove = async (w: Worker) => {
    if (!confirm(`Move ${w.name} to Trash? You can restore them for 30 days.`)) return;
    // 1) Revoke their app login first so they can't sign in any more.
    if (w.user_id) {
      const { data, error } = await supabase.functions.invoke("worker-revoke-login", {
        body: { worker_id: w.id },
      });
      if (error || (data as any)?.error) {
        toast({
          title: "Couldn't revoke login",
          description: (data as any)?.error || error?.message || "Try again",
          variant: "destructive",
        });
        return;
      }
    }
    // 2) Soft-delete the worker row.
    const { softDelete } = await import("@/lib/softDelete");
    const { error } = await softDelete("workers", w.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== w.id));
    toast({
      title: "Moved to Trash",
      description: w.user_id
        ? "Login revoked. Restore from Admin → Trash within 30 days."
        : "Restore from Admin → Trash within 30 days.",
    });
    load();
  };

  const openLogin = (w: Worker) => {
    setLoginWorker(w);
    setLoginPhone((w.login_phone || w.whatsapp_number || w.phone || "").replace(/\D+/g, ""));
    // Generate a memorable random 4-digit PIN as a sensible default
    setLoginPin(String(Math.floor(1000 + Math.random() * 9000)));
    setLastCreds(null);
    setCopied(false);
  };

  const saveLogin = async () => {
    if (!loginWorker) return;
    const cleanPhone = loginPhone.replace(/\D+/g, "");
    const cleanPin = loginPin.replace(/\D+/g, "");
    if (cleanPhone.length < 8) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      toast({ title: "PIN must be 4–6 digits", variant: "destructive" });
      return;
    }
    setLoginSaving(true);
    const { data, error } = await supabase.functions.invoke("worker-create-login", {
      body: { worker_id: loginWorker.id, phone: cleanPhone, pin: cleanPin },
    });
    setLoginSaving(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Login setup failed",
        description: (data as any)?.error || error?.message || "Try again",
        variant: "destructive",
      });
      return;
    }
    setLastCreds({ phone: cleanPhone, pin: cleanPin, name: loginWorker.name });
    toast({ title: "Login ready", description: `${loginWorker.name} can sign in now` });
    void load();
  };

  const shareCreds = () => {
    if (!lastCreds) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const msg =
      `Hi ${lastCreds.name}, your work portal login:\n\n` +
      `🔗 ${origin}/worker/login\n` +
      `📱 Phone: ${lastCreds.phone}\n` +
      `🔑 PIN: ${lastCreds.pin}\n\n` +
      `Open the link, enter phone + PIN to see your assigned jobs and update progress.`;
    const url = `https://wa.me/${lastCreds.phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyCreds = async () => {
    if (!lastCreds) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = `Login: ${origin}/worker/login\nPhone: ${lastCreds.phone}\nPIN: ${lastCreds.pin}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <AdminShell>
      {!authLoading && !isAdmin && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <h1 className="font-display text-xl">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view Workers.</p>
        </div>
      )}
      {!authLoading && isAdmin && (<>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Workers</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Contacts for assigning Job Work Orders via WhatsApp.</p>
        </div>
        <Button onClick={startNew} className="w-full sm:w-auto"><UserPlus className="mr-2 h-4 w-4" /> Add worker</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((w) => (
            <Card key={w.id} className={!w.is_active ? "opacity-60" : ""}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <HardHat className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{w.name}</p>
                    {w.trade && <p className="text-xs text-muted-foreground">{w.trade}</p>}
                    <p className="mt-1 text-sm flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-primary" /> {w.whatsapp_number}</p>
                    {w.phone && w.phone !== w.whatsapp_number && <p className="text-xs text-muted-foreground">Call: {w.phone}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {w.user_id ? (
                        <Badge variant="secondary" className="gap-1">
                          <KeyRound className="h-3 w-3" /> Login active
                          {w.login_phone && <span className="font-mono text-[10px] opacity-80">· {w.login_phone}</span>}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <KeyRound className="h-3 w-3" /> No login
                        </Badge>
                      )}
                    </div>
                    {!w.is_active && <Badge variant="outline" className="mt-1">Inactive</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" asChild title="View jobs">
                    <Link to={`/admin/workers/${w.id}`}><ListChecks className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openLogin(w)} title={w.user_id ? "Reset login PIN" : "Create login"}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(w)}><Pencil className="h-4 w-4" /></Button>
                  {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove(w)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No workers yet. Add your first one.</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle>{editing ? "Edit worker" : "Add worker"}</DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
            onFocusCapture={scrollFocusedIntoView}
          >
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>WhatsApp number * (with country code, e.g. 919526610404)</Label><Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="91XXXXXXXXXX" /></div>
            <div className="space-y-1.5"><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Trade</Label><Input value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} placeholder="Carpenter, Polish, Upholstery..." /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex items-center justify-between rounded-md border p-3"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Worker login</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Worker signs in at <span className="font-mono text-foreground">/worker/login</span> using their phone (username) and PIN (password).
              </p>
              <div className="space-y-1.5">
                <Label>Username — phone number (with country code)</Label>
                <Input
                  inputMode="tel"
                  value={form.login_phone}
                  onChange={(e) => setForm({ ...form, login_phone: e.target.value })}
                  placeholder="91XXXXXXXXXX"
                />
                <p className="text-xs text-muted-foreground">Defaults to WhatsApp number. Must be unique per worker.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Password (PIN, 4–6 digits) {editing && <span className="text-muted-foreground font-normal">— leave blank to keep current</span>}</Label>
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    value={form.login_pin}
                    onChange={(e) => setForm({ ...form, login_pin: e.target.value })}
                    maxLength={6}
                    placeholder={editing ? "Enter new PIN to reset" : "e.g. 1234"}
                  />
                  <Button type="button" variant="outline" onClick={() => setForm({ ...form, login_pin: randomPin() })}>
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!loginWorker} onOpenChange={(o) => { if (!o) { setLoginWorker(null); setLastCreds(null); } }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              {loginWorker?.user_id ? "Reset login PIN" : "Create worker login"}
            </DialogTitle>
          </DialogHeader>
          {loginWorker && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                <strong>{loginWorker.name}</strong> will sign in at{" "}
                <span className="font-mono text-foreground">/worker/login</span> using their phone number and a 4–6 digit PIN.
              </p>
              <div className="space-y-1.5">
                <Label>Phone number (digits only, with country code)</Label>
                <Input
                  inputMode="tel"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="919526610404"
                />
              </div>
              <div className="space-y-1.5">
                <Label>PIN (4–6 digits)</Label>
                <Input
                  inputMode="numeric"
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">A random 4-digit PIN was suggested. Change it if you like.</p>
              </div>

              {lastCreds && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-semibold text-primary">Login ready ✓</p>
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">Phone:</span> <span className="font-mono">{lastCreds.phone}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">PIN:</span> <span className="font-mono font-semibold">{lastCreds.pin}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={copyCreds}>
                      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button size="sm" onClick={shareCreds}>
                      <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Send via WhatsApp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => { setLoginWorker(null); setLastCreds(null); }}>
              {lastCreds ? "Done" : "Cancel"}
            </Button>
            <Button onClick={saveLogin} disabled={loginSaving}>
              {loginSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loginWorker?.user_id ? "Reset PIN" : "Create login"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>)}
    </AdminShell>
  );
};

export default AdminWorkers;
