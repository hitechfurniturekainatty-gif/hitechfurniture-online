import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Loader2, Gauge, CalendarDays } from "lucide-react";

type Row = {
  assigned_to: string | null;
  display_name: string | null;
  chats: number;
  open_chats: number;
  won: number;
  showroom_visits: number;
  avg_first_reply_min: number | null;
  overdue_24h: number;
  lost: number;
};

type Appt = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  visit_at: string;
  requirement: string | null;
  status: string;
  assigned_to: string | null;
};

const mins = (m: number | null) => {
  if (m == null) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};

const Page = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const [r, a, p] = await Promise.all([
      (supabase as any).from("v_team_performance").select("*"),
      (supabase as any)
        .from("showroom_appointments")
        .select("id,customer_name,customer_phone,visit_at,requirement,status,assigned_to")
        .gte("visit_at", since.toISOString())
        .order("visit_at")
        .limit(100),
      supabase.from("profiles").select("user_id,display_name"),
    ]);
    setRows(((r.data ?? []) as Row[]).sort((x, y) => y.chats - x.chats));
    setAppts((a.data ?? []) as Appt[]);
    setNames(Object.fromEntries((p.data ?? []).map((x: any) => [x.user_id, x.display_name || "Staff"])));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const setApptStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("showroom_appointments").update({ status }).eq("id", id);
    if (!error) setAppts((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const total = rows.reduce(
    (t, r) => ({
      chats: t.chats + r.chats,
      open: t.open + r.open_chats,
      won: t.won + r.won,
      visits: t.visits + r.showroom_visits,
      overdue: t.overdue + r.overdue_24h,
    }),
    { chats: 0, open: 0, won: 0, visits: 0, overdue: 0 },
  );

  return (
    <AdminShell>
      <h1 className="mb-1 flex items-center gap-2 font-display text-2xl">
        <Gauge className="h-6 w-6 text-primary" /> Team Performance
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        WhatsApp chats per staff — reply speed, open chats, showroom visits and wins.
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Total chats", total.chats],
              ["Open", total.open],
              ["Showroom visit", total.visits],
              ["Won", total.won],
              ["24h+ no reply", total.overdue],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className={`text-2xl font-semibold ${l === "24h+ no reply" && Number(v) > 0 ? "text-rose-600" : ""}`}>
                  {v}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  {["Staff", "Chats", "Open", "Visit", "Won", "Lost", "Avg first reply", "24h+ no reply"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.assigned_to ?? "none"} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      {r.assigned_to ? r.display_name || "Staff" : "Unassigned"}
                    </td>
                    <td className="px-3 py-2">{r.chats}</td>
                    <td className="px-3 py-2">{r.open_chats}</td>
                    <td className="px-3 py-2">{r.showroom_visits}</td>
                    <td className="px-3 py-2 text-emerald-700">{r.won}</td>
                    <td className="px-3 py-2 text-rose-700">{r.lost}</td>
                    <td className="px-3 py-2">{mins(r.avg_first_reply_min)}</td>
                    <td className={`px-3 py-2 ${r.overdue_24h ? "font-semibold text-rose-600" : ""}`}>{r.overdue_24h}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Chats assign ചെയ്യാൻ <Link to="/admin/whatsapp" className="text-primary underline">WhatsApp Inbox</Link> തുറക്കുക.
          </p>

          <div>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4" /> Showroom visits (today onwards)
            </h2>
            {appts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits booked.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {appts.map((a) => (
                  <div key={a.id} className="rounded-xl border bg-card p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{a.customer_name || a.customer_phone}</span>
                      <span className="text-xs">{new Date(a.visit_at).toLocaleString("en-IN")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.customer_phone} · {a.assigned_to ? names[a.assigned_to] ?? "Staff" : "Unassigned"}
                    </p>
                    {a.requirement && <p className="mt-1 text-xs">{a.requirement}</p>}
                    <select
                      className="mt-2 rounded-md border bg-background px-2 py-1 text-xs"
                      value={a.status}
                      onChange={(e) => void setApptStatus(a.id, e.target.value)}
                    >
                      {["booked", "confirmed", "visited", "no_show", "cancelled"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
};

const AdminTeamPerformance = () => (
  <OfficeStaffOnly>
    <Page />
  </OfficeStaffOnly>
);

export default AdminTeamPerformance;
