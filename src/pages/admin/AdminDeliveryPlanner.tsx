import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, Clock3, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/brand";

type DeliveryRow = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  expected_delivery_date: string | null;
  status: string | null;
  commercial_status: string | null;
  document_type: string | null;
  pipeline_stage: number | null;
  total: number | null;
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const dateFromKey = (key: string) => {
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y, m-1, d);
};

const prettyDate = (key: string) =>
  dateFromKey(key).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

const isCancelled = (r: DeliveryRow) => {
  const s = `${r.status ?? ""} ${r.commercial_status ?? ""}`.toLowerCase();
  return /reject|cancel|void/.test(s);
};

export default function AdminDeliveryPlanner() {
  const todayKey = localKey(new Date());
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [monthCursor, setMonthCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [qRes, tripRes] = await Promise.all([
        supabase
          .from("quotations")
          .select("id, quotation_id, party_name, party_place, party_phone, expected_delivery_date, status, commercial_status, document_type, pipeline_stage, total")
          .is("deleted_at", null),
        supabase
          .from("trip_quotations")
          .select("quotation_id, delivered_at, trips:trip_id(status)")
      ]);

      if (!mounted) return;

      const delivered = new Set<string>();
      for (const item of (tripRes.data ?? []) as any[]) {
        if (item.delivered_at || item.trips?.status === "delivered") delivered.add(item.quotation_id);
      }

      const clean = ((qRes.data ?? []) as DeliveryRow[])
        .filter((r) => (r.document_type ?? "quotation") !== "po")
        .filter((r) => !isCancelled(r))
        .filter((r) => r.commercial_status === "confirmed" || r.status === "finalized" || Number(r.pipeline_stage ?? 0) >= 3);

      setRows(clean);
      setDeliveredIds(delivered);
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, []);

  const pendingRows = useMemo(() => rows.filter((r) => !deliveredIds.has(r.id)), [rows, deliveredIds]);
  const undatedRows = useMemo(() => pendingRows.filter((r) => !r.expected_delivery_date), [pendingRows]);
  const datedPendingRows = useMemo(() => pendingRows.filter((r) => !!r.expected_delivery_date), [pendingRows]);
  const overdueRows = useMemo(() => datedPendingRows.filter((r) => r.expected_delivery_date! < todayKey), [datedPendingRows, todayKey]);
  const todayRows = useMemo(() => datedPendingRows.filter((r) => r.expected_delivery_date === todayKey), [datedPendingRows, todayKey]);
  const upcomingRows = useMemo(() => datedPendingRows.filter((r) => r.expected_delivery_date! > todayKey), [datedPendingRows, todayKey]);

  const pendingByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of datedPendingRows) {
      const k = r.expected_delivery_date!;
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [datedPendingRows]);

  const selectedRows = useMemo(() =>
    rows
      .filter((r) => r.expected_delivery_date === selectedDate)
      .sort((a,b) => Number(deliveredIds.has(a.id)) - Number(deliveredIds.has(b.id))),
  [rows, selectedDate, deliveredIds]);

  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const last = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
  const cells: Array<Date | null> = [];
  for (let i=0;i<first.getDay();i++) cells.push(null);
  for (let d=1;d<=last.getDate();d++) cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const moveMonth = (delta: number) => {
    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  return (
    <AdminShell>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Delivery</h1>
            <p className="mt-1 text-sm text-muted-foreground">Quotation delivery-date planner, pending report and daily schedule.</p>
          </div>
          <Button variant="outline" onClick={() => {
            const n = new Date();
            setSelectedDate(todayKey);
            setMonthCursor(new Date(n.getFullYear(), n.getMonth(), 1));
          }}>
            <CalendarDays className="mr-2 h-4 w-4" /> Today
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-amber-300 bg-amber-50/70 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">Today</span><Clock3 className="h-5 w-5 text-amber-600" /></div>
              <div className="mt-2 text-3xl font-bold">{todayRows.length}</div>
              <div className="text-xs text-muted-foreground">deliveries due today</div>
            </CardContent>
          </Card>
          <Card className="border-red-300 bg-red-50/70 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">Overdue / Pending</span><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div className="mt-2 text-3xl font-bold">{overdueRows.length}</div>
              <div className="text-xs text-muted-foreground">past date, not marked delivered</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">Upcoming</span><CalendarDays className="h-5 w-5 text-emerald-600" /></div>
              <div className="mt-2 text-3xl font-bold">{upcomingRows.length}</div>
              <div className="text-xs text-muted-foreground">future pending deliveries</div>
            </CardContent>
          </Card>
          <Card className="border-slate-300 bg-slate-50/70 dark:bg-slate-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">Date not set</span><AlertTriangle className="h-5 w-5 text-slate-600" /></div>
              <div className="mt-2 text-3xl font-bold">{undatedRows.length}</div>
              <div className="text-xs text-muted-foreground">quotations needing a delivery date</div>
            </CardContent>
          </Card>
        </div>

        {undatedRows.length > 0 && (
          <Card className="border-slate-300">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Delivery date not set</h2>
                  <p className="text-xs text-muted-foreground">Set a delivery date so these quotations appear on the calendar.</p>
                </div>
                <Badge variant="outline">{undatedRows.length}</Badge>
              </div>
              <div className="grid gap-2">
                {undatedRows.slice(0, 8).map((r) => (
                  <Link key={r.id} to={`/admin/quotations/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold">{r.quotation_id}</div>
                      <div className="truncate font-medium">{r.party_name} · {r.party_place}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {overdueRows.length > 0 && (
          <Card className="border-red-300">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-red-700 dark:text-red-300">Overdue deliveries</h2>
                  <p className="text-xs text-muted-foreground">These remain here until delivery is marked complete.</p>
                </div>
                <Badge variant="destructive">{overdueRows.length}</Badge>
              </div>
              <div className="grid gap-2">
                {overdueRows.slice(0, 8).map((r) => (
                  <Link key={r.id} to={`/admin/quotations/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border bg-red-50/40 p-3 hover:bg-red-50 dark:bg-red-950/10">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold">{r.quotation_id}</div>
                      <div className="truncate font-medium">{r.party_name} · {r.party_place}</div>
                      <div className="text-xs text-red-700 dark:text-red-300">{prettyDate(r.expected_delivery_date!)}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-3 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <Button size="icon" variant="outline" onClick={() => moveMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="text-center">
                <div className="font-display text-lg font-semibold">{MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear()}</div>
                <div className="text-xs text-muted-foreground">Number badge = pending quotations</div>
              </div>
              <Button size="icon" variant="outline" onClick={() => moveMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground sm:gap-2 sm:text-xs">
              {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={`blank-${i}`} className="min-h-16 sm:min-h-20" />;
                const key = localKey(d);
                const count = pendingByDate[key] ?? 0;
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;
                const isPast = key < todayKey;
                const tone = count === 0
                  ? "border-border bg-background"
                  : isPast
                    ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                    : isToday
                      ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                      : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    className={`relative min-h-16 rounded-lg border p-1.5 text-left transition hover:shadow-sm sm:min-h-20 sm:p-2 ${tone} ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
                  >
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-primary text-primary-foreground" : ""}`}>{d.getDate()}</span>
                    {count > 0 && (
                      <span className={`absolute bottom-1.5 right-1.5 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white sm:text-xs ${isPast ? "bg-red-600" : isToday ? "bg-amber-600" : "bg-emerald-600"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold">{prettyDate(selectedDate)}</h2>
                <p className="text-xs text-muted-foreground">All quotations scheduled for this delivery date.</p>
              </div>
              <Badge variant="outline">{selectedRows.filter((r) => !deliveredIds.has(r.id)).length} pending</Badge>
            </div>

            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading delivery report…</div>
            ) : selectedRows.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No deliveries scheduled for this date.</div>
            ) : (
              <div className="space-y-2">
                {selectedRows.map((r) => {
                  const delivered = deliveredIds.has(r.id);
                  return (
                    <div key={r.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold">{r.quotation_id}</span>
                          {delivered
                            ? <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />Delivered</Badge>
                            : <Badge variant={selectedDate < todayKey ? "destructive" : "outline"}>{selectedDate < todayKey ? "Pending / Overdue" : selectedDate === todayKey ? "Today" : "Pending"}</Badge>}
                        </div>
                        <div className="mt-1 font-semibold">{r.party_name}</div>
                        <div className="text-sm text-muted-foreground">{r.party_place}{r.party_phone ? ` · ${r.party_phone}` : ""}</div>
                        {typeof r.total === "number" && <div className="mt-1 text-sm font-medium">{formatINR(r.total)}</div>}
                      </div>
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline"><Link to={`/admin/quotations/${r.id}/preview`}>Preview</Link></Button>
                        <Button asChild size="sm"><Link to={`/admin/quotations/${r.id}`}>Open</Link></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
