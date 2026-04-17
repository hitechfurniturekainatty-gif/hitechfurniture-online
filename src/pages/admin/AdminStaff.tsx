import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, ShieldCheck, User as UserIcon, Ruler } from "lucide-react";

type StaffRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: "admin" | "staff" | "measurement_staff" | null;
  created_at: string;
};

const roleLabel = { admin: "Admin", staff: "Office Staff", measurement_staff: "Measurement Staff" } as const;
const roleColor = {
  admin: "bg-primary text-primary-foreground",
  staff: "bg-secondary text-secondary-foreground",
  measurement_staff: "bg-accent text-accent-foreground",
} as const;

const AdminStaff = () => {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", role: "staff" as StaffRow["role"] });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("list-staff-users");
    if (error) {
      toast({ title: "Failed to load staff", description: error.message, variant: "destructive" });
    } else {
      setRows((data?.users ?? []) as StaffRow[]);
    }
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
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: form.email, password: form.password, display_name: form.display_name, role: form.role },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast({ title: "Create failed", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Account created", description: `${form.email} added as ${roleLabel[form.role!]}` });
    setOpen(false);
    setForm({ email: "", password: "", display_name: "", role: "staff" });
    load();
  };

  const updateRole = async (userId: string, newRole: StaffRow["role"]) => {
    if (!newRole) return;
    const { error } = await supabase.functions.invoke("admin-update-user-role", {
      body: { user_id: userId, role: newRole },
    });
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Role updated" });
    load();
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Staff Management</h1>
          <p className="mt-1 text-muted-foreground">Create accounts and assign roles for your team.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> Add staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create new staff account</DialogTitle></DialogHeader>
            <div className="space-y-3">
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
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" minLength={8} required />
              </div>
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={form.role ?? undefined} onValueChange={(v) => setForm({ ...form, role: v as StaffRow["role"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (full access)</SelectItem>
                    <SelectItem value="staff">Office Staff</SelectItem>
                    <SelectItem value="measurement_staff">Measurement Staff (field)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={createUser} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.user_id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {r.role === "admin" ? <ShieldCheck className="h-5 w-5 text-primary" /> :
                      r.role === "measurement_staff" ? <Ruler className="h-5 w-5 text-primary" /> :
                        <UserIcon className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.display_name || r.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={r.role ? roleColor[r.role] : "bg-muted"}>{r.role ? roleLabel[r.role] : "No role"}</Badge>
                  {r.user_id !== user?.id && (
                    <Select value={r.role ?? undefined} onValueChange={(v) => updateRole(r.user_id, v as StaffRow["role"])}>
                      <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Change role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="staff">Office Staff</SelectItem>
                        <SelectItem value="measurement_staff">Measurement Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-center text-muted-foreground py-8">No staff accounts yet.</p>}
        </div>
      )}
    </AdminShell>
  );
};

export default AdminStaff;
