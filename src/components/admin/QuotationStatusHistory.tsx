import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { statusBadgeVariant, statusLabel } from "@/pages/admin/AdminQuotationEditor";

/**
 * Read-only audit log of every status change for a given quotation.
 * Rows are written automatically by the `quotations_status_audit` trigger,
 * so all we do here is render them. Re-fetches whenever `refreshKey` changes
 * so the editor can force a refresh after a manual status update.
 */
type Row = {
  id: string;
  status: string;
  changed_by: string | null;
  changed_at: string;
};

export const QuotationStatusHistory = ({
  quotationId,
  refreshKey = 0,
}: {
  quotationId: string;
  refreshKey?: number;
}) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("quotation_status_history")
        .select("id, status, changed_by, changed_at")
        .eq("quotation_id", quotationId)
        .order("changed_at", { ascending: false });
      if (cancelled) return;
      const list = (data ?? []) as Row[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.changed_by).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", ids);
        const map: Record<string, string> = {};
        (profiles ?? []).forEach((p: any) => {
          map[p.user_id] = p.display_name || p.email || "Staff";
        });
        if (!cancelled) setNames(map);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [quotationId, refreshKey]);

  if (!loading && rows.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Status history
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const who = r.changed_by ? names[r.changed_by] ?? "Staff" : "System";
          const when = new Date(r.changed_at).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">Moved to</span>
              <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
              <span className="text-muted-foreground">by</span>
              <span className="font-medium">{who}</span>
              <span className="text-muted-foreground">on</span>
              <span className="font-mono text-xs">{when}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};