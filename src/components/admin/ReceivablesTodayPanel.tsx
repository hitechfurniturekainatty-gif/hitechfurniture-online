import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Loader2, Phone } from "lucide-react";

const db=supabase as any;
type Row={id:string;customer_name:string|null;phone:string|null;place:string|null;pending_amount:number;next_follow_up_at:string|null;source:string|null};
const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0);
const target=(r:Row)=>r.source==="quotation"?"/admin/backlog#order-receivables":"/admin/backlog#manual-receivables";

export function ReceivablesTodayPanel(){
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const{data}=await db.from("receivables").select("id,customer_name,phone,place,pending_amount,next_follow_up_at,source").is("closed_at",null).gt("pending_amount",0).not("next_follow_up_at","is",null).order("next_follow_up_at",{ascending:true}).limit(50);setRows(data??[]);setLoading(false)})()},[]);
 const today=key(new Date());const due=useMemo(()=>rows.filter(r=>r.next_follow_up_at&&key(new Date(r.next_follow_up_at))<=today),[rows,today]);const overdue=due.filter(r=>r.next_follow_up_at&&key(new Date(r.next_follow_up_at))<today);const total=due.reduce((s,r)=>s+Number(r.pending_amount||0),0);
 if(loading)return <Card><CardContent className="flex justify-center p-5"><Loader2 className="h-5 w-5 animate-spin"/></CardContent></Card>;
 return <section className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-display text-xl font-semibold">Receivables Today</h2><p className="text-xs text-muted-foreground">Customer balances whose promised follow-up date is today or overdue.</p></div><Button asChild size="sm" variant="outline"><Link to="/admin/backlog#order-receivables">Open Receivables</Link></Button></div><div className="grid gap-2 sm:grid-cols-3"><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Call Today / Overdue</p><p className="text-2xl font-bold">{due.length}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Overdue Calls</p><p className="text-2xl font-bold">{overdue.length}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Balance in Follow-up</p><p className="text-2xl font-bold">{money(total)}</p></CardContent></Card></div>{due.length>0&&<Card><CardContent className="divide-y p-0">{due.slice(0,5).map(r=><div key={r.id} className="flex flex-wrap items-center gap-3 p-3"><div className="flex-1"><div className="flex flex-wrap gap-1"><Badge variant={r.next_follow_up_at&&key(new Date(r.next_follow_up_at))<today?"destructive":"default"}>{r.next_follow_up_at&&key(new Date(r.next_follow_up_at))<today?"OVERDUE":"CALL TODAY"}</Badge><Badge variant="outline">{r.source==="quotation"?"Order":"Manual"}</Badge></div><p className="mt-1 font-medium">{r.customer_name||"Customer"}</p><p className="text-xs text-muted-foreground">{[r.place,r.phone].filter(Boolean).join(" · ")}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Balance to Receive</p><p className="font-semibold">{money(Number(r.pending_amount))}</p></div>{r.phone&&<Button asChild size="icon" variant="outline"><a href={`tel:+91${r.phone}`}><Phone className="h-4 w-4"/></a></Button>}<Button asChild size="sm" variant="outline"><Link to={target(r)}><CalendarClock className="mr-1 h-4 w-4"/>Open</Link></Button></div>)}</CardContent></Card>}{due.length===0&&<p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">No receivable calls due today.</p>}</section>;
}
