import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Row = {
  id: string;
  assigned_qty: number;
  completed_qty: number;
  received_qty: number;
  quotation_item_id: string;
  item: {
    description: string;
    quantity: number;
    ready_stock_qty: number;
  } | null;
};

export const JobQuantityProgress = ({
  jobId,
  editable = true,
  allowReceive = false,
  onSaved,
}: {
  jobId: string;
  editable?: boolean;
  allowReceive?: boolean;
  onSaved?: () => void;
}) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const db = supabase as any;
    const { data, error } = await db
      .from("job_work_order_items")
      .select("id, assigned_qty, completed_qty, received_qty, quotation_item_id, quotation_items(description, quantity, ready_stock_qty)")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) {
      setLoading(false);
      return;
    }

    const mapped: Row[] = (data ?? []).map((r: any) => ({
      id: r.id,
      assigned_qty: Number(r.assigned_qty ?? 0),
      completed_qty: Number(r.completed_qty ?? 0),
      received_qty: Number(r.received_qty ?? 0),
      quotation_item_id: r.quotation_item_id,
      item: r.quotation_items
        ? {
            description: r.quotation_items.description,
            quantity: Number(r.quotation_items.quantity ?? 0),
            ready_stock_qty: Number(r.quotation_items.ready_stock_qty ?? 0),
          }
        : null,
    }));

    setRows(mapped);
    setDrafts(Object.fromEntries(mapped.map((r) => [r.id, String(r.completed_qty)])));
    setReceivedDrafts(Object.fromEntries(mapped.map((r) => [r.id, String(r.received_qty)])));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [jobId]);

  const totals = useMemo(
    () => rows.reduce(
      (a, r) => ({
        assigned: a.assigned + r.assigned_qty,
        completed: a.completed + r.completed_qty,
        received: a.received + r.received_qty,
      }),
      { assigned: 0, completed: 0, received: 0 },
    ),
    [rows],
  );

  const saveRow = async (row: Row) => {
    const next = Math.max(0, Math.min(row.assigned_qty, Number(drafts[row.id] ?? row.completed_qty)));
    setSaving(row.id);
    const db = supabase as any;
    const { error } = await db.rpc("set_job_item_completed_qty", {
      p_job_item_id: row.id,
      p_completed_qty: next,
    });
    setSaving(null);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Item progress updated",
      description: `${row.item?.description ?? "Item"}: ${next}/${row.assigned_qty} complete`,
    });
    await load();
    onSaved?.();
  };

  const receiveRow = async (row: Row) => {
    const next = Math.max(0, Math.min(row.completed_qty, Number(receivedDrafts[row.id] ?? row.received_qty)));
    setSaving("receive-" + row.id);
    const db = supabase as any;
    const { error } = await db.rpc("set_job_item_received_qty", {
      p_job_item_id: row.id,
      p_received_qty: next,
    });
    setSaving(null);

    if (error) {
      toast({ title: "Receive failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Item received",
      description: `${row.item?.description ?? "Item"}: ${next}/${row.assigned_qty} received`,
    });
    await load();
    onSaved?.();
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading item progress…</div>;
  }

  if (!rows.length) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item progress</p>
        <p className="text-xs font-medium">
          Completed {totals.completed}/{totals.assigned} · Received {totals.received}/{totals.assigned} · Pending {Math.max(0, totals.assigned - totals.completed)}
        </p>
      </div>

      {rows.map((row) => {
        const pending = Math.max(0, row.assigned_qty - row.completed_qty);
        const receivePending = Math.max(0, row.completed_qty - row.received_qty);
        return (
          <div key={row.id} className="rounded-md border border-border/50 bg-background p-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.item?.description ?? "Item"}</p>
                <p className="text-xs text-muted-foreground">
                  Assigned {row.assigned_qty} · Completed {row.completed_qty} · Worker pending {pending} · Received {row.received_qty}
                </p>
              </div>
              {row.item && (
                <p className="text-xs font-semibold text-primary">
                  Quotation ready: {row.item.ready_stock_qty}/{row.item.quantity}
                </p>
              )}
            </div>

            {editable && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={row.assigned_qty}
                  step="1"
                  value={drafts[row.id] ?? String(row.completed_qty)}
                  onChange={(e) => setDrafts((p) => ({ ...p, [row.id]: e.target.value }))}
                  className="h-9 w-24"
                  aria-label={`Completed quantity for ${row.item?.description ?? "item"}`}
                />
                <Button
                  size="sm"
                  className="h-9"
                  disabled={saving === row.id}
                  onClick={() => void saveRow(row)}
                >
                  {saving === row.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={saving === row.id}
                  onClick={() => setDrafts((p) => ({ ...p, [row.id]: String(row.assigned_qty) }))}
                >
                  All done
                </Button>
              </div>
            )}

            {allowReceive && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
                <span className="text-xs font-medium">Office receive</span>
                <Input
                  type="number"
                  min={0}
                  max={row.completed_qty}
                  step="1"
                  value={receivedDrafts[row.id] ?? String(row.received_qty)}
                  onChange={(e) => setReceivedDrafts((p) => ({ ...p, [row.id]: e.target.value }))}
                  className="h-9 w-24"
                  aria-label={`Received quantity for ${row.item?.description ?? "item"}`}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  disabled={saving === "receive-" + row.id || row.completed_qty <= row.received_qty}
                  onClick={() => void receiveRow(row)}
                >
                  {saving === "receive-" + row.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                  Receive
                </Button>
                {receivePending > 0 && <span className="text-xs text-amber-700">Awaiting receipt: {receivePending}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
