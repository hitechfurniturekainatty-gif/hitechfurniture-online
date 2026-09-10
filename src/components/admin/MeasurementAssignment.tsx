import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Image as ImageIcon } from 'lucide-react';

type Item = {
  id: string;
  description: string;
  item_image_url?: string | null;
  quantity?: number;
  item_notes?: string | null;
  fulfillment_route?: 'ready_stock' | 'custom';
};

const firstImage = (value?: string | null) =>
  (value ?? '').split(/\r?\n/).map(v => v.trim()).find(Boolean) ?? null;

export function MeasurementAssignment({ quotationId, items, open, onClose }: { quotationId: string; items: Item[]; open: boolean; onClose: () => void }) {
 const [staff,setStaff]=useState<any[]>([]),[routes,setRoutes]=useState<any[]>([]);
 const [assignee,setAssignee]=useState(''),[route,setRoute]=useState(''),[day,setDay]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{ if(!open)return; setSelected([]); setError('');
 void Promise.all([supabase.functions.invoke('list-staff-users'),supabase.from('delivery_routes').select('id,name').eq('is_active',true).is('deleted_at',null),supabase.from('quotations').select('delivery_route_id').eq('id',quotationId).single()]).then(([s,r,q])=>{
 if(s.error || s.data?.error || r.error || q.error) {setError('Could not load assignment details. Close and retry.');return;}
 setStaff((s.data?.users??[]).filter((x:any)=>['measurement_staff','staff','admin'].includes(x.role)));setRoutes(r.data??[]);setRoute(q.data?.delivery_route_id??'');
 }).catch(()=>setError('Could not load assignment details. Close and retry.'));
 },[open,quotationId]);
 const assign=async()=>{setBusy(true);try{
 const {error}=await (supabase as any).rpc('assign_item_measurement',{q_id:quotationId,staff_id:assignee,selected_ids:selected,route_id:route||null,visit_on:day||null});
 if(error)throw error;toast({title:'Measurement assigned',description:'Staff can reply from Measurement Tasks.'});onClose();
 }catch(e:any){setError(e.message??'Assignment failed');}finally{setBusy(false);}};
 return <Dialog open={open} onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Assign measurement / അളവെടുക്കാൻ നൽകുക</DialogTitle><DialogDescription>Quotation preview പോലെ item, quantity, photo നോക്കി ശരിയായ items മാത്രം തിരഞ്ഞെടുക്കുക.</DialogDescription></DialogHeader>
 <p className="text-sm text-muted-foreground">അളവെടുക്കേണ്ട items മാത്രം tick ചെയ്യുക. Photo + item name + quantity ഒരുമിച്ച് കാണുന്നതിനാൽ correct model confirm ചെയ്ത് assign ചെയ്യാം.</p>
 {error&&<p role="alert" className="text-destructive">{error}</p>}
 <div className="space-y-2">
 {items.map((i,index)=>{const image=firstImage(i.item_image_url);const checked=selected.includes(i.id);return <label key={i.id} className={`grid cursor-pointer grid-cols-[auto_72px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-2.5 transition ${checked?'border-primary bg-primary/5 ring-1 ring-primary/20':'hover:border-primary/40 hover:bg-muted/40'}`}>
   <input className="h-5 w-5" type="checkbox" checked={checked} onChange={e=>setSelected(v=>e.target.checked?[...v,i.id]:v.filter(id=>id!==i.id))}/>
   <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border bg-muted">{image?<img src={image} alt={i.description||'Quotation item'} loading="eager" className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6"/></div>}</div>
   <div className="min-w-0">
     <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">#{index+1}</span><span className="text-xs font-semibold text-muted-foreground">Qty {i.quantity ?? 0}</span></div>
     <p className="mt-1 truncate text-sm font-semibold text-foreground">{i.description||'Unnamed item'}</p>
     {i.item_notes?.trim()?<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{i.item_notes}</p>:null}
     <p className="mt-1 text-[10px] font-medium text-muted-foreground">{i.fulfillment_route==='custom'?'Custom / Production':'Ready Stock'}</p>
   </div>
 </label>})}
 </div>
 <label>Staff<select className="block w-full rounded border p-2" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Choose staff</option>{staff.map(s=><option key={s.user_id} value={s.user_id}>{s.display_name||s.email}</option>)}</select></label>
 <label>Route<select className="block w-full rounded border p-2" value={route} onChange={e=>setRoute(e.target.value)}><option value="">Choose route</option>{routes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
 <label>Visit date<input className="block w-full rounded border p-2" type="date" value={day} onChange={e=>setDay(e.target.value)}/></label>
 <Button disabled={busy||!assignee||!route||(items.length>0&&!selected.length)} onClick={assign}>{busy?'Assigning…':'Assign measurement'}</Button>
 </DialogContent></Dialog>;
}
