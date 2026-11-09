import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { leadCreatorLabel, leadSourceLabel } from "@/lib/leadSource";

export function QuotationOrigin({ quotationId }: { quotationId: string }) {
  const [details, setDetails] = useState<{ source: string; creator: string; salesperson: string; quoteCreator: string; leadId?: string; followUp?: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setDetails(null); setFailed(false);
    void (async () => {
      try {
        const [leadRes, quoteRes] = await Promise.all([
          (supabase as any).from("sales_leads").select("id,source,created_by,assigned_to,next_follow_up_at").eq("converted_quotation_id", quotationId).limit(1).maybeSingle(),
          supabase.from("quotations").select("created_by,salesperson_name").eq("id", quotationId).single(),
        ]);
        if (leadRes.error || quoteRes.error) throw leadRes.error || quoteRes.error;
        const lead = leadRes.data; const quote = quoteRes.data;
        const ids = [...new Set([lead?.created_by, lead?.assigned_to, quote.created_by].filter(Boolean))];
        const names: Record<string, string> = {};
        if (ids.length) {
          const profiles = await supabase.from("profiles").select("user_id,display_name").in("user_id", ids);
          if (profiles.error) throw profiles.error;
          for (const p of profiles.data ?? []) names[p.user_id] = p.display_name || "Staff name unavailable";
        }
        if (active) setDetails({
          source: lead ? leadSourceLabel(lead.source) : "Direct quotation · No linked lead",
          creator: lead ? leadCreatorLabel(lead.source, lead.created_by, names) : quote.created_by ? names[quote.created_by] || "Staff name unavailable" : "Not recorded",
          quoteCreator: quote.created_by ? names[quote.created_by] || "Staff name unavailable" : "Not recorded",
          salesperson: quote.salesperson_name || (lead?.assigned_to ? names[lead.assigned_to] || "Staff name unavailable" : "Not assigned"),
          leadId: lead?.id, followUp: lead?.next_follow_up_at,
        });
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; };
  }, [quotationId]);
  return <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground" title="Enquiry source & responsibility">
    {failed ? <span role="alert">Source details could not be loaded. Reload to retry.</span> : !details ? <span>Loading source…</span> : <>
      <span>Source: <b className="font-medium text-foreground">{details.source}</b></span>
      <span>Enquiry by: <b className="font-medium text-foreground">{details.creator}</b></span>
      <span>Salesman: <b className="font-medium text-foreground">{details.salesperson}</b></span>
      <span>Quote by: <b className="font-medium text-foreground">{details.quoteCreator}</b></span>
      {details.leadId && <Link className="font-medium text-primary underline" to={`/admin/leads?open=${details.leadId}`}>Open lead →</Link>}
    </>}
  </div>;
}
