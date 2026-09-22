import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Clock3, FileText, Loader2, Search, UserRound, Warehouse } from "lucide-react";

type Worker={id:string;name:string;trade:string|null};
type Job={id:string;worker_id:string|null;quotation_id:string|null;status:string;warehouse_status:string|null;due_at:string|null;created_at:string};
type JobItem={id:string;job_id:string;quotation_item_id:string;assigned_qty:number;completed_qty:number;received_qty:number};
type Quote={id:string;quotation_id:string;party_name:string;party_place:string;expected_delivery_date:string|null};
type QuoteItem={id:string;quotation_id:string;description:string;quantity:number;fulfillment_route:string|null};

const finished=(s:string)=>["ready","delivered"].includes(s);
const label=(s:string)=>({assigned:"Assigned",started:"Started",in_progress:"Working",ready:"Completed / Ready",delivered:"Delivered"} as Record<string,string>)[s]??s;

export default function AdminWorkerReports(){
  const[loading,setLoading]=useState(true);
  const[workers,setWorkers]=useState<Worker[]>([]);
  const[jobs,setJobs]=useState<Job[]>([]);
  const[jobItems,setJobItems]=useState<JobItem[]>([]);
  const[quotes,setQuotes]=useState<Quote[]>([]);
  const[quoteItems,setQuoteItems]=useState<QuoteItem[]>([]);
  const[selectedQuote,setSelectedQuote]=useState<string|null>(null);
  const[search,setSearch]=useState("");
  const[statusFilter,setStatusFilter]=useState("pending");
  const[workerFilter,setWorkerFilter]=useState("all");

  const load=useCallback(async()=>{
    setLoading(true);
    const[w,j,ji,q,qi]=await Promise.all([
      supabase.from("workers").select("id,name,trade").is("deleted_at",null).order("name"),
      supabase.from("job_work_orders").select("id,worker_id,quotation_id,status,warehouse_status,due_at,created_at").is("deleted_at",null),
      supabase.from("job_work_order_items").select("id,job_id,quotation_item_id,assigned_qty,completed_qty,received_qty"),
      supabase.from("quotations").select("id,quotation_id,party_name,party_place,expected_delivery_date").is("deleted_at",null),
      supabase.from("quotation_items").select("id,quotation_id,description,quantity,fulfillment_route")
    ]);
    setWorkers((w.data??[]) as Worker[]);
    setJobs((j.data??[]) as Job[]);
    setJobItems(((ji.data??[]) as any[]).map(r=>({...r,assigned_qty:Number(r.assigned_qty??0),completed_qty:Number(r.completed_qty??0),received_qty:Number(r.received_qty??0)})));
    setQuotes((q.data??[]) as Quote[]);
    setQuoteItems(((qi.data??[]) as any[]).map(r=>({...r,quantity:Number(r.quantity??0)})));
    setLoading(false);
  },[]);

  useEffect(()=>{load()},[load]);
  useEffect(()=>{
    const ch=supabase.channel("worker-reports-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"job_work_orders"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"job_work_order_items"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"worker_status_updates"},load)
      .subscribe();
    return()=>{supabase.removeChannel(ch)};
  },[load]);

  const workerMap=useMemo(()=>new Map(workers.map(w=>[w.id,w])),[workers]);
  const itemMap=useMemo(()=>new Map(quoteItems.map(i=>[i.id,i])),[quoteItems]);

  const quoteRows=useMemo(()=>quotes.map(q=>{
    const qJobs=jobs.filter(j=>j.quotation_id===q.id);
    const qJobIds=new Set(qJobs.map(j=>j.id));
    const jis=jobItems.filter(i=>qJobIds.has(i.job_id));
    const pending=jis.reduce((s,i)=>s+Math.max(0,i.assigned_qty-i.completed_qty),0);
    const receivePending=jis.reduce((s,i)=>s+Math.max(0,i.completed_qty-i.received_qty),0);
    const workingJobs=qJobs.filter(j=>["started","in_progress"].includes(j.status)).length;
    const overdueJobs=qJobs.filter(j=>j.due_at&&!finished(j.status)&&new Date(j.due_at).getTime()<Date.now()).length;
    const customItems=new Set(jis.map(i=>i.quotation_item_id)).size;
    const completed=jis.reduce((s,i)=>s+i.completed_qty,0);
    const assigned=jis.reduce((s,i)=>s+i.assigned_qty,0);
    return{q,qJobs,jis,pending,receivePending,workingJobs,overdueJobs,customItems,completed,assigned};
  }).filter(x=>x.qJobs.length>0||x.customItems>0),[quotes,jobs,jobItems]);

  const filtered=useMemo(()=>{
    const s=search.trim().toLowerCase();
    return quoteRows.filter(x=>{
      if(s&&!x.q.quotation_id.toLowerCase().includes(s)&&!x.q.party_name.toLowerCase().includes(s)&&!x.q.party_place.toLowerCase().includes(s))return false;
      if(workerFilter!=="all"&&!x.qJobs.some(j=>j.worker_id===workerFilter))return false;
      if(statusFilter==="pending"&&x.pending<=0)return false;
      if(statusFilter==="working"&&x.workingJobs<=0)return false;
      if(statusFilter==="overdue"&&x.overdueJobs<=0)return false;
      if(statusFilter==="completed"&&!(x.assigned>0&&x.pending===0))return false;
      return true;
    }).sort((a,b)=>a.overdueJobs!==b.overdueJobs?b.overdueJobs-a.overdueJobs:b.pending-a.pending);
  },[quoteRows,search,workerFilter,statusFilter]);

  const selected=selectedQuote?quoteRows.find(x=>x.q.id===selectedQuote)??null:null;

  const itemDetails=useMemo(()=>{
    if(!selected)return[];
    return selected.jis.map(ji=>{
      const job=selected.qJobs.find(j=>j.id===ji.job_id);
      return{ji,job,item:itemMap.get(ji.quotation_item_id)??null,worker:job?.worker_id?workerMap.get(job.worker_id)??null:null,pending:Math.max(0,ji.assigned_qty-ji.completed_qty),receivePending:Math.max(0,ji.completed_qty-ji.received_qty)};
    }).sort((a,b)=>b.pending-a.pending);
  },[selected,itemMap,workerMap]);

  return <AdminShell><div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><h1 className="font-display text-2xl font-bold sm:text-3xl">Work Progress Reports</h1><p className="mt-1 text-sm text-muted-foreground">Quotation-first, item-wise worker / carpenter progress.</p></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative min-w-[220px]"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Quotation / customer"/></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="working">Working</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="all">All</SelectItem></SelectContent></Select>
        <Select value={workerFilter} onValueChange={setWorkerFilter}><SelectTrigger><SelectValue placeholder="All workers"/></SelectTrigger><SelectContent><SelectItem value="all">All workers</SelectItem>{workers.map(w=><SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
      </div>
    </div>

    {loading?<div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary"/></div>:selected?
      <div className="space-y-4">
        <Button variant="ghost" className="px-1" onClick={()=>setSelectedQuote(null)}>← All quotations</Button>
        <Card className="border-primary/30 bg-primary/[0.03]"><CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="font-mono text-sm font-bold">{selected.q.quotation_id}</div><div className="font-display text-xl font-bold">{selected.q.party_name} · {selected.q.party_place}</div><div className="mt-1 text-xs text-muted-foreground">{selected.q.expected_delivery_date?"Customer delivery: "+new Date(selected.q.expected_delivery_date).toLocaleDateString("en-IN"):"Delivery date not set"}</div></div>
            <div className="flex flex-wrap gap-2"><Badge variant="destructive">Pending {selected.pending}</Badge><Badge variant="outline">Working {selected.workingJobs}</Badge>{selected.overdueJobs>0&&<Badge variant="destructive">Overdue {selected.overdueJobs}</Badge>}<Button asChild size="sm" variant="outline"><Link to={"/admin/quotations/"+selected.q.id}><FileText className="mr-1 h-4 w-4"/>Open Quotation</Link></Button></div>
          </div>
        </CardContent></Card>
        <div className="space-y-2">
          {itemDetails.map(({ji,job,item,worker,pending,receivePending})=><Card key={ji.id}><CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0"><div className="font-semibold">{item?.description??"Quotation item"}</div><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Assigned {ji.assigned_qty}</span><span>Completed {ji.completed_qty}</span><span>Received {ji.received_qty}</span></div><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline"><UserRound className="mr-1 h-3 w-3"/>{worker?.name??"Unassigned worker"}</Badge><Badge variant={job&&finished(job.status)?"secondary":"outline"}>{job?label(job.status):"No job status"}</Badge>{job?.due_at&&<Badge variant={new Date(job.due_at).getTime()<Date.now()&&!finished(job.status)?"destructive":"outline"}>Due {new Date(job.due_at).toLocaleDateString("en-IN")}</Badge>}</div></div>
              <div className="flex flex-wrap gap-2">{pending>0?<Badge variant="destructive"><Clock3 className="mr-1 h-3 w-3"/>Pending {pending}</Badge>:<Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3"/>Work complete</Badge>}{receivePending>0&&<Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"><Warehouse className="mr-1 h-3 w-3"/>Receive pending {receivePending}</Badge>}</div>
            </div>
          </CardContent></Card>)}
        </div>
      </div>
      :
      <div className="space-y-3">
        {filtered.map(x=><button key={x.q.id} type="button" onClick={()=>setSelectedQuote(x.q.id)} className="block w-full text-left"><Card className="border-2 border-primary/15 transition hover:border-primary/40 hover:shadow-md"><CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold">{x.q.quotation_id}</span>{x.overdueJobs>0&&<Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3"/>Overdue {x.overdueJobs}</Badge>}</div><div className="mt-1 font-display text-lg font-bold">{x.q.party_name} · {x.q.party_place}</div><div className="mt-1 text-xs text-muted-foreground">{x.customItems} work items · {x.qJobs.length} worker jobs</div></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[430px]"><div className="rounded-lg border bg-red-50/60 p-2 dark:bg-red-950/20"><div className="text-[10px] text-muted-foreground">Item Pending</div><div className="font-semibold">{x.pending}</div></div><div className="rounded-lg border bg-amber-50/60 p-2 dark:bg-amber-950/20"><div className="text-[10px] text-muted-foreground">Working</div><div className="font-semibold">{x.workingJobs}</div></div><div className="rounded-lg border bg-emerald-50/60 p-2 dark:bg-emerald-950/20"><div className="text-[10px] text-muted-foreground">Completed</div><div className="font-semibold">{x.completed}/{x.assigned}</div></div><div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">Receive Pending</div><div className="font-semibold">{x.receivePending}</div></div></div>
          </div>
        </CardContent></Card></button>)}
        {filtered.length===0&&<div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No quotations found for this filter.</div>}
      </div>}
  </div></AdminShell>;
}