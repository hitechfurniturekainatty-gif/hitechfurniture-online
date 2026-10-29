import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Search, Phone, Send, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, UserPlus, CalendarPlus, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Message = {
  id: number;
  phone: string;
  customer_name: string | null;
  direction: "incoming" | "outgoing";
  message_text: string;
  created_at: string;
};

type ConvMeta = {
  id: string;
  contact_id: string;
  assigned_to: string | null;
  status: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  ai_paused_until: string | null;
};

type Staff = { user_id: string; display_name: string | null };

const STATUSES: [string, string][] = [
  ["open", "Open"],
  ["follow_up", "Follow-up"],
  ["showroom_visit", "Showroom visit"],
  ["won", "Won"],
  ["lost", "Lost"],
  ["closed", "Closed"],
];
const statusLabel = (s: string) => STATUSES.find(([v]) => v === s)?.[1] ?? s;
const statusTone: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  follow_up: "bg-amber-100 text-amber-800",
  showroom_visit: "bg-violet-100 text-violet-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-rose-100 text-rose-800",
  closed: "bg-muted text-muted-foreground",
};
const isOverdue = (m?: ConvMeta) =>
  !!m &&
  ["open", "follow_up"].includes(m.status) &&
  !!m.last_inbound_at &&
  new Date(m.last_inbound_at) > new Date(m.last_outbound_at ?? 0) &&
  Date.now() - new Date(m.last_inbound_at).getTime() > 24 * 3600 * 1000;

type Conversation = {
  phone: string;
  customer_name: string | null;
  lastMessage: string;
  lastAt: string;
  messages: Message[];
};

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const InboxPage = () => {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [q, setQ] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const navigate = useNavigate();
  // Open the Leads page with this chat pre-filled (it reuses an existing open lead for the same number).
  const makeLead = (c: { phone: string; customer_name: string | null; messages: Message[] }) => {
    const lastText = [...c.messages].reverse().find((m) => m.direction === "incoming" && m.message_text && !/^I received a \w+ message/i.test(m.message_text))?.message_text ?? "";
    const q = new URLSearchParams({ new: "1", source: "whatsapp", phone: c.phone, name: c.customer_name ?? "", req: lastText.slice(0, 500) });
    navigate(`/admin/leads?${q.toString()}`);
  };
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [healthLoading, setHealthLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [meta, setMeta] = useState<Record<string, ConvMeta>>({});
  const [staff, setStaff] = useState<Staff[]>([]);
  const [view, setView] = useState("all");
  const [visitAt, setVisitAt] = useState("");
  const [visitNote, setVisitNote] = useState("");
  const [booking, setBooking] = useState(false);

  const loadMeta = async () => {
    const { data } = await (supabase as any)
      .from("chat_conversations")
      .select("id,contact_id,assigned_to,status,last_inbound_at,last_outbound_at,ai_paused_until")
      .eq("channel", "whatsapp");
    if (data) setMeta(Object.fromEntries((data as ConvMeta[]).map((c) => [c.contact_id, c])));
  };

  const loadStaff = async () => {
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("user_id,display_name"),
      supabase.from("user_roles").select("user_id,role").in("role", ["admin", "staff"]),
    ]);
    const ok = new Set((r.data ?? []).map((x: any) => x.user_id));
    setStaff(((p.data ?? []) as Staff[]).filter((x) => ok.has(x.user_id)));
  };

  const staffName = (id: string | null) =>
    id ? staff.find((s) => s.user_id === id)?.display_name || "Staff" : "Unassigned";

  const updateMeta = async (phone: string, patch: Partial<ConvMeta>) => {
    const cur = meta[phone];
    if (!cur) {
      toast({ title: "Chat record not ready yet, refresh once", variant: "destructive" });
      return;
    }
    const extra: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status && ["won", "lost", "closed"].includes(patch.status)) extra.closed_at = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("chat_conversations")
      .update({ ...patch, ...extra })
      .eq("id", cur.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setMeta((prev) => ({ ...prev, [phone]: { ...cur, ...patch } }));
  };

  const bookVisit = async () => {
    if (!active || !visitAt) return;
    setBooking(true);
    const cur = meta[active.phone];
    const { error } = await (supabase as any).from("showroom_appointments").insert({
      conversation_id: cur?.id ?? null,
      customer_name: active.customer_name,
      customer_phone: active.phone,
      visit_at: new Date(visitAt).toISOString(),
      requirement: visitNote || null,
      assigned_to: cur?.assigned_to ?? user?.id ?? null,
      source: "staff",
    });
    setBooking(false);
    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      return;
    }
    await updateMeta(active.phone, { status: "showroom_visit" });
    setVisitAt("");
    setVisitNote("");
    toast({ title: "Showroom visit booked", description: new Date(visitAt).toLocaleString("en-IN") });
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("whatsapp_messages")
      .select("id,phone,customer_name,direction,message_text,created_at")
      .order("created_at", { ascending: true })
      .limit(2000);
    if (!error && data) setMessages(data as Message[]);
    setLoading(false);
  };

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-reply-health", { body: {} });
      if (error) throw error;
      setHealth(data ?? null);
    } catch (e) {
      setHealth({ ok: false, connected: false, error: e instanceof Error ? e.message : "Diagnostics unavailable" });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadHealth();
    loadMeta();
    loadStaff();
  }, []);

  // Realtime: new messages append live without a full reload.
  useEffect(() => {
    const ch = supabase
      .channel("rt-whatsapp-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          void loadMeta();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const conversations = useMemo<Conversation[]>(() => {
    const byPhone = new Map<string, Message[]>();
    for (const m of messages) {
      const arr = byPhone.get(m.phone) ?? [];
      arr.push(m);
      byPhone.set(m.phone, arr);
    }
    const list: Conversation[] = [];
    for (const [phone, msgs] of byPhone.entries()) {
      const sorted = [...msgs].sort(
        (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
      );
      const last = sorted[sorted.length - 1];
      const name = [...sorted].reverse().find((m) => m.customer_name)?.customer_name ?? null;
      list.push({
        phone,
        customer_name: name,
        lastMessage: last.message_text,
        lastAt: last.created_at,
        messages: sorted,
      });
    }
    return list.sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
  }, [messages]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byView = conversations.filter((c) => {
      const m = meta[c.phone];
      if (view === "all") return true;
      if (view === "mine") return m?.assigned_to === user?.id;
      if (view === "unassigned") return !m?.assigned_to;
      if (view === "overdue") return isOverdue(m);
      return (m?.status ?? "open") === view;
    });
    if (!needle) return byView;
    return byView.filter(
      (c) =>
        c.phone.toLowerCase().includes(needle) ||
        (c.customer_name ?? "").toLowerCase().includes(needle) ||
        c.lastMessage.toLowerCase().includes(needle),
    );
  }, [conversations, q, view, meta, user?.id]);

  // Auto-select the first conversation once loaded (desktop convenience).
  useEffect(() => {
    if (!selectedPhone && filtered.length > 0) setSelectedPhone(filtered[0].phone);
  }, [filtered, selectedPhone]);

  const active = filtered.find((c) => c.phone === selectedPhone) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!active || !text || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-reply", {
        body: {
          phone: active.phone,
          customer_name: active.customer_name,
          message: text,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.detail || data?.error || "Message could not be sent");

      setReply("");
      if (meta[active.phone]) {
        void updateMeta(active.phone, {
          ai_paused_until: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        });
      }
      if (data.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message as Message],
        );
      }
      toast({
        title: "WhatsApp reply sent",
        description: data.gateway ? `Sent via ${data.gateway === "n8n" ? "n8n" : "WhatsApp Cloud API"}` : undefined,
      });
      void loadHealth();
    } catch (e) {
      toast({
        title: "Reply not sent",
        description: e instanceof Error ? e.message : "WhatsApp sending failed",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminShell>
      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" /> WhatsApp Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Customer conversations from WhatsApp — office staff can reply directly from here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs">
          {healthLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Checking WhatsApp send connection…</>
          ) : health?.connected ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-foreground">Send connection ready</span>
              <span className="text-muted-foreground">
                {health?.gateways?.n8n ? "n8n" : ""}
                {health?.gateways?.n8n && health?.gateways?.cloud_api ? " + " : ""}
                {health?.gateways?.cloud_api ? "Cloud API fallback" : ""}
              </span>
              {health?.last_failure && (
                <span className="ml-1 text-amber-700">
                  Last failure: {health.last_failure.gateway} · {health.last_failure.error_message || "send failed"}
                </span>
              )}
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">WhatsApp sending not connected</span>
              <span className="text-muted-foreground">Configure n8n webhook or WhatsApp Cloud API server secrets.</span>
            </>
          )}
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-primary hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Recheck
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
          <MessageCircle className="h-10 w-10" />
          <p>No WhatsApp conversations yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr] md:h-[calc(100vh-220px)]">
          {/* Conversation list */}
          <div className="flex flex-col rounded-lg border bg-card md:overflow-hidden">
            <div className="space-y-2 border-b p-2">
              <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
                {[
                  ["all", "All"],
                  ["mine", "Mine"],
                  ["unassigned", "Unassigned"],
                  ["overdue", "24h+ no reply"],
                  ...STATUSES,
                ].map(([v, l]) => {
                  const n =
                    v === "overdue"
                      ? conversations.filter((c) => isOverdue(meta[c.phone])).length
                      : null;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1",
                        view === v ? "bg-[#0E5C66] text-white" : "hover:bg-muted",
                      )}
                    >
                      {l}
                      {n ? ` (${n})` : ""}
                    </button>
                  );
                })}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, phone, message"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="md:overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => setSelectedPhone(c.phone)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b px-3 py-3 text-left transition-colors hover:bg-muted/60",
                    selectedPhone === c.phone && "bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {c.customer_name || c.phone}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(c.lastAt)}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{c.phone}</span>
                  <span className="truncate text-sm text-muted-foreground">{c.lastMessage}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                    <span className={cn("rounded px-1.5 py-0.5 font-medium", statusTone[meta[c.phone]?.status ?? "open"])}>
                      {statusLabel(meta[c.phone]?.status ?? "open")}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{staffName(meta[c.phone]?.assigned_to ?? null)}</span>
                    {isOverdue(meta[c.phone]) && (
                      <span className="flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-700">
                        <Clock className="h-3 w-3" /> 24h+
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation thread */}
          <div className="flex flex-col rounded-lg border bg-card md:overflow-hidden">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                  <div>
                    <p className="font-medium">{active.customer_name || active.phone}</p>
                    <a
                      href={`tel:${active.phone}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Phone className="h-3 w-3" /> {active.phone}
                    </a>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => makeLead(active)}>
                    <UserPlus className="mr-1.5 h-4 w-4" /> Lead ആക്കുക
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2 text-xs">
                  <label className="flex items-center gap-1">
                    Assign
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={meta[active.phone]?.assigned_to ?? ""}
                      onChange={(e) => void updateMeta(active.phone, { assigned_to: e.target.value || null })}
                    >
                      <option value="">Unassigned</option>
                      {staff.map((s) => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.display_name || "Staff"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    Status
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={meta[active.phone]?.status ?? "open"}
                      onChange={(e) => void updateMeta(active.phone, { status: e.target.value })}
                    >
                      {STATUSES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  {meta[active.phone]?.ai_paused_until &&
                    new Date(meta[active.phone]!.ai_paused_until!) > new Date() && (
                      <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">
                        AI paused till {formatTime(meta[active.phone]!.ai_paused_until!)}
                      </span>
                    )}
                  <span className="ml-auto flex flex-wrap items-center gap-1">
                    <input
                      type="datetime-local"
                      value={visitAt}
                      onChange={(e) => setVisitAt(e.target.value)}
                      className="rounded-md border bg-background px-2 py-1"
                    />
                    <input
                      value={visitNote}
                      onChange={(e) => setVisitNote(e.target.value)}
                      placeholder="Requirement"
                      className="w-28 rounded-md border bg-background px-2 py-1"
                    />
                    <Button size="sm" variant="outline" disabled={!visitAt || booking} onClick={() => void bookVisit()}>
                      <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Visit book
                    </Button>
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {active.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.direction === "outgoing" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                          m.direction === "outgoing"
                            ? "bg-[#0E5C66] text-white"
                            : "bg-muted",
                        )}
                      >
                        {m.message_text}
                        <div
                          className={cn(
                            "mt-1 text-[10px] opacity-70",
                            m.direction === "outgoing" ? "text-white" : "text-muted-foreground",
                          )}
                        >
                          {formatTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div className="border-t bg-background p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendReply();
                        }
                      }}
                      placeholder="Type a WhatsApp reply…"
                      rows={2}
                      maxLength={4096}
                      className="min-h-[52px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={sending || !reply.trim()}
                      className="inline-flex h-[52px] min-w-[52px] items-center justify-center rounded-xl bg-[#0E5C66] px-4 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Send WhatsApp reply"
                    >
                      {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>Enter to send · Shift+Enter for new line</span>
                    <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Secure server send</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
};

const AdminWhatsAppInbox = () => (
  <OfficeStaffOnly>
    <InboxPage />
  </OfficeStaffOnly>
);

export default AdminWhatsAppInbox;
