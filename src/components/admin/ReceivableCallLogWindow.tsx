import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { GripHorizontal, Loader2, Minus, Phone, Send, StickyNote, X } from "lucide-react";

export type CallLog = {
  id: string;
  note: string;
  created_at: string;
};

type Props = {
  open: boolean;
  receivableId: string | null;
  title: string;
  onClose: () => void;
};

/** Floating, draggable window for capturing per-customer follow-up call narrations. */
export const ReceivableCallLogWindow = ({ open, receivableId, title, onClose }: Props) => {
  const [pos, setPos] = useState({ x: 24, y: 80 });
  const [size, setSize] = useState({ w: 360, h: 440 });
  const [minimized, setMinimized] = useState(false);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const dragRef = useRef<{ kind: "move" | "resize" | null; sx: number; sy: number; bx: number; by: number; bw: number; bh: number }>({
    kind: null, sx: 0, sy: 0, bx: 0, by: 0, bw: 0, bh: 0,
  });

  useEffect(() => {
    if (!open || !receivableId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("receivable_call_logs")
        .select("id, note, created_at")
        .eq("receivable_id", receivableId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) toast({ title: "Failed to load notes", description: error.message, variant: "destructive" });
      else setLogs((data as CallLog[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, receivableId]);

  const onPointerDown = useCallback((kind: "move" | "resize") => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind, sx: e.clientX, sy: e.clientY, bx: pos.x, by: pos.y, bw: size.w, bh: size.h };
  }, [pos.x, pos.y, size.w, size.h]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.kind) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.kind === "move") {
      setPos({
        x: Math.min(Math.max(8, d.bx + dx), window.innerWidth - 80),
        y: Math.min(Math.max(8, d.by + dy), window.innerHeight - 60),
      });
    } else {
      setSize({
        w: Math.max(280, Math.min(window.innerWidth - 16, d.bw + dx)),
        h: Math.max(260, Math.min(window.innerHeight - 16, d.bh + dy)),
      });
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = { kind: null, sx: 0, sy: 0, bx: 0, by: 0, bw: 0, bh: 0 };
  }, []);

  const addNote = async () => {
    if (!receivableId || !draft.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("receivable_call_logs")
      .insert({ receivable_id: receivableId, note: draft.trim() })
      .select("id, note, created_at")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }
    setLogs((l) => [data as CallLog, ...l]);
    setDraft("");
  };

  const removeNote = async (id: string) => {
    const { error } = await supabase.from("receivable_call_logs").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setLogs((l) => l.filter((x) => x.id !== id));
  };

  if (!open || !receivableId) return null;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed z-[70] flex items-center gap-2 rounded-full border border-primary/40 bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg"
        style={{ left: pos.x, top: pos.y }}
      >
        <Phone className="h-3.5 w-3.5" /> {title} ({logs.length})
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Call follow-up notes"
      className="fixed z-[70] flex flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="flex shrink-0 cursor-move select-none items-center gap-1 border-b border-border bg-muted/70 px-2 py-1.5"
        onPointerDown={onPointerDown("move")}
      >
        <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
        <StickyNote className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-medium">Call log · {title}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(true)} aria-label="Minimise">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : logs.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No call notes yet. Add what you discussed below.</p>
        ) : (
          logs.map((l) => (
            <div key={l.id} className="rounded-md border border-border bg-muted/30 p-2 text-xs">
              <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{new Date(l.created_at).toLocaleString()}</span>
                <button onClick={() => removeNote(l.id)} className="hover:text-destructive" aria-label="Delete">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="whitespace-pre-wrap leading-snug">{l.note}</p>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-background p-2 space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What did the customer say?"
          className="min-h-[60px] text-xs"
        />
        <Button onClick={addNote} disabled={saving || !draft.trim()} size="sm" className="w-full gap-1">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Add note
        </Button>
      </div>

      <div
        className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize"
        onPointerDown={onPointerDown("resize")}
        aria-label="Resize"
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%, hsl(var(--border)) 60%, transparent 60%, transparent 70%, hsl(var(--border)) 70%, hsl(var(--border)) 80%, transparent 80%)",
        }}
      />
    </div>
  );
};

export default ReceivableCallLogWindow;