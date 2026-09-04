import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { STAGE_DEFS, type PipelineStage } from "@/lib/quotationPipeline";

type Notif = {
  id: string;
  quotation_id: string | null;
  stage: number;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  source_type: string | null;
  source_id: string | null;
};

export const PipelineNotificationsBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("pipeline_notifications")
      .select("id, quotation_id, stage, title, body, created_at, read_at, source_type, source_id")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("rt-pipeline-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((n) => !n.read_at).length;
  const markAll = async () => {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("pipeline_notifications").update({ read_at: new Date().toISOString(), read_by: user?.id ?? null }).in("id", ids);
    load();
  };

  const destination = (n: Notif) => {
    if (n.source_type === "receivable_followup_due" && n.source_id) return `/admin/backlog?followup=${n.source_id}`;
    if (n.quotation_id) return `/admin/quotations/${n.quotation_id}`;
    return `/admin/quotations?stage=${n.stage}`;
  };

  if (!user) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative h-11 w-11" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Today's alerts & handoffs</span>
          {unread > 0 && <Button variant="ghost" size="sm" onClick={markAll}>Mark all read</Button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</div>}
          {items.map((n) => {
            const stageDef = STAGE_DEFS[n.stage as PipelineStage];
            const receivable = n.source_type === "receivable_followup_due";
            return <Link key={n.id} to={destination(n)} className={"block border-b px-3 py-2 hover:bg-muted/50 " + (!n.read_at ? "bg-primary/5" : "")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{n.title}</span>
                {receivable ? <Badge variant="outline" className="text-[10px]">Receivable</Badge> : stageDef && <Badge variant="outline" className="text-[10px]">{stageDef.label}</Badge>}
              </div>
              {n.body && <div className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</div>}
              <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{new Date(n.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
            </Link>;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
