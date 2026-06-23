import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, ShieldCheck, User as UserIcon, Ruler, Pencil, KeyRound, Trash2, Eye, EyeOff, MessageCircle, Truck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BacklogPinCard } from "@/components/admin/BacklogPinCard";

type Role = "admin" | "staff" | "measurement_staff" | "delivery" | "warehouse";
type StaffRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  whatsapp_number: string | null;
  role: Role | null;
  created_at: string;
};

const roleLabel: Record<Role, string> = {
  admin: "Admin",
  staff: "Office Staff",
  measurement_staff: "Measurement Staff",
  delivery: "Delivery Driver",
  warehouse: "Warehouse",
};
const roleColor: Record<Role, string> = {
  admin: "bg-primary text-primary-foreground",
  staff: "bg-secondary text-secondary-foreground",
  measurement_staff: "bg-accent text-accent-foreground",
  delivery: "bg-muted text-foreground border border-border",
  warehouse: "bg-muted text-foreground border border-border",
};

const AdminStaff = () => {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [workerByUserId, setWorkerByUserId] = useState<Record<string, { id: string; name: string }>>({});
  const [loading, setLoading] = useState(true);

  // Create
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [form, setForm] = useState<{ email: string; password: string; display_name: string; whatsapp_number: string; role: Role }>({
    email: "", password: "", display_name: "", whatsapp_number: "", role: "staff",
  });

  // Edit
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [editForm, setEditForm] = useState<{ display_name: string; email: string; whatsapp_number: string; role: Role; password: string }>({
    display_name: "", email: "", whatsapp_number: "", role: "staff", password: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [showEditPw, setShowEditPw] = useState(false);

  // Helper: invoke an edge function and surface the JSON body's `error` even on non-2xx
  const invokeFn = async (name: string, body: unknown) => {
    const { data, error } = await supabase.functions.invoke(name, { body });
    let payload: any = data;
    if (error && (error as any).context?.json) {
      try { payload = await (error as any).context.json(); } catch { /* ignore */ }
    } else if (error && (error as any).context?.text) {
      try { payload = { error: await (error as any).context.text() }; } catch { /* ignore */ }
    }
    if (payload?.error) throw new Error(payload.error);
    if (error) throw new Error(error.message);
    return payload;
  };

  const load = async () => {
    setLoading(true);
    const [{ data, error }, wRes] = await Promise.all([
      supabase.functions.invoke("list-staff-users"),
      supabase.from("workers").select("id, name, user_id").not("user_id", "is", null).is("deleted_at", null),
    ]);
    if (error) {
      toast({ title: "Failed to load staff", description: error.message, variant: "destructive" });
    } else {
      setRows((data?.users ?? []) as StaffRow[]);
    }
    const map: Record<string, { id: string; name: string }> = {};
    ((wRes.data ?? []) as any[]).forEach((w) => {
      if (w.user_id) map[w.user_id] = { id: w.id, name: w.name };
    });
    setWorkerByUserId(map);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const createUser = async () => {
    if (!form.email || !form.password || !form.role) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }
    if (form.password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: form.email, password: form.password, display_name: form.display_name, whatsapp_number: form.whatsapp_number, role: form.role },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast({ title: "Create failed", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Account created", description: `${form.email} added as ${roleLabel[form.role]}` });
    setOpenCreate(false);
    setForm({ email: "", password: "", display_name: "", whatsapp_number: "", role: "staff" });
    load();
  };

  const openEdit = (r: StaffRow) => {
    setEditing(r);
    setEditForm({
      display_name: r.display_name ?? "",
      email: r.email ?? "",
      whatsapp_number: r.whatsapp_number ?? "",
      role: (r.role ?? "staff") as Role,
      password: "",
    });
    setShowEditPw(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      // Profile (name + email + whatsapp)
      if (
        (editForm.display_name ?? "") !== (editing.display_name ?? "") ||
        (editForm.email ?? "") !== (editing.email ?? "") ||
        (editForm.whatsapp_number ?? "") !== (editing.whatsapp_number ?? "")
      ) {
        await invokeFn("admin-update-user-role", {
          user_id: editing.user_id, action: "update_profile",
          display_name: editForm.display_name, email: editForm.email,
          whatsapp_number: editForm.whatsapp_number,
        });
      }
      // Role
      if (editForm.role !== editing.role && editing.user_id !== user?.id) {
        await invokeFn("admin-update-user-role", {
          user_id: editing.user_id, action: "set_role", role: editForm.role,
        });
      }
      // Password
      if (editForm.password) {
        if (editForm.password.length < 8) throw new Error("Password must be at least 8 characters");
        await invokeFn("admin-update-user-role", {
          user_id: editing.user_id, action: "set_password", password: editForm.password,
        });
      }
      toast({ title: "Staff updated" });
      setEditing(null);
      load();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteUser = async (r: StaffRow) => {
    try {
      await invokeFn("admin-update-user-role", { user_id: r.user_id, action: "delete" });
      toast({ title: "Account deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  if (!isAdmin) {
    return (
      <AdminShell>
        <p className="text-muted-foreground">Only admins can manage staff.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Staff Management</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Create accounts, reset passwords and assign roles.</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><UserPlus className="mr-2 h-4 w-4" /> Add staff</Button>
          </DialogTrigger>
          <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
            <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
              <DialogTitle>Create new staff account</DialogTitle>
            </DialogHeader>
            <div
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
              onFocusCapture={scrollFocusedIntoView}
            >
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Temporary password * (min 8 characters)</Label>
                <div className="relative">
                  <Input
                    type={showCreatePw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowCreatePw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCreatePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp number (with country code, e.g. 919895134482)</Label>
                <Input
                  value={form.whatsapp_number}
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                  placeholder="91XXXXXXXXXX"
                  inputMode="tel"
                />
                <p className="text-[11px] text-muted-foreground">Used to auto-send job &amp; measurement assignments via WhatsApp.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="admin">Admin (full access)</SelectItem>
                     <SelectItem value="staff">Office Staff</SelectItem>
                     <SelectItem value="measurement_staff">Measurement Staff (field)</SelectItem>
                     <SelectItem value="delivery">Delivery Driver (trips only)</SelectItem>
                     <SelectItem value="warehouse">Warehouse (stock & dispatch)</SelectItem>
                   </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
              <Button variant="outline" onClick={() => setOpenCreate(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={createUser} disabled={creating} className="w-full sm:w-auto">
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isAdmin && (
        <div className="mb-4">
          <BacklogPinCard />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const isSelf = r.user_id === user?.id;
            return (
              <Card key={r.user_id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                      {r.role === "admin" ? <ShieldCheck className="h-5 w-5 text-primary" /> :
                        r.role === "measurement_staff" ? <Ruler className="h-5 w-5 text-primary" /> :
                          r.role === "delivery" ? <Truck className="h-5 w-5 text-primary" /> :
                            <UserIcon className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.display_name || r.email} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                      {r.whatsapp_number && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MessageCircle className="h-3 w-3 text-primary" /> {r.whatsapp_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={r.role ? roleColor[r.role] : "bg-muted"}>{r.role ? roleLabel[r.role] : "No role"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    {!isSelf && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes <span className="font-medium">{r.email}</span> and revokes their access. Their past data (tasks, quotations) is kept.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteUser(r)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {rows.length === 0 && <p className="text-center text-muted-foreground py-8">No staff accounts yet.</p>}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle>Edit staff account</DialogTitle>
            <DialogDescription>Update profile, change role, or reset password.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
              onFocusCapture={scrollFocusedIntoView}
            >
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">Changing email updates the login email immediately.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp number</Label>
                <Input
                  value={editForm.whatsapp_number}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp_number: e.target.value })}
                  placeholder="91XXXXXXXXXX (with country code)"
                  inputMode="tel"
                />
                <p className="text-[11px] text-muted-foreground">Used to auto-send job &amp; measurement assignments.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm({ ...editForm, role: v as Role })}
                  disabled={editing.user_id === user?.id}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Office Staff</SelectItem>
                    <SelectItem value="measurement_staff">Measurement Staff</SelectItem>
                    <SelectItem value="delivery">Delivery Driver</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                  </SelectContent>
                </Select>
                {editing.user_id === user?.id && (
                  <p className="text-[11px] text-muted-foreground">You can't change your own role.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> New password (optional)</Label>
                <div className="relative">
                  <Input
                    type={showEditPw ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave blank to keep current password"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowEditPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showEditPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Min 8 characters. Share the new password with the staff member.</p>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setEditing(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="w-full sm:w-auto">
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminStaff;
