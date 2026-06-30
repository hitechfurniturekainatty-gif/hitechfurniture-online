import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Search, Phone, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  phone: string;
  customer_name: string | null;
  direction: "incoming" | "outgoing";
  message_text: string;
  created_at: string;
};

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
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    load();
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
    if (!needle) return conversations;
    return conversations.filter(
      (c) =>
        c.phone.toLowerCase().includes(needle) ||
        (c.customer_name ?? "").toLowerCase().includes(needle) ||
        c.lastMessage.toLowerCase().includes(needle),
    );
  }, [conversations, q]);

  // Auto-select the first conversation once loaded (desktop convenience).
  useEffect(() => {
    if (!selectedPhone && filtered.length > 0) setSelectedPhone(filtered[0].phone);
  }, [filtered, selectedPhone]);

  const active = filtered.find((c) => c.phone === selectedPhone) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length]);

  return (
    <AdminShell>
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="font-display text-2xl flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" /> WhatsApp Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Customer conversations handled by the AI assistant — read-only view.
        </p>
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
            <div className="border-b p-2">
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
                <div className="flex items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
                  <ArrowDownToLine className="h-3 w-3" /> AI-handled conversation · read-only
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
