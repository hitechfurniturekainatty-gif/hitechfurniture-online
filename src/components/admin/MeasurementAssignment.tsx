import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
type Item = { id: string; description: string };
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
 return <Dialog open={open} onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Assign measurement / അളവെടുക്കാൻ നൽകുക</DialogTitle></DialogHeader>
 <p className="text-sm text-muted-foreground">അളവെടുക്കേണ്ട items മാത്രം തിരഞ്ഞെടുക്കുക. Reply അതേ quotation-ൽ ലഭിക്കും.</p>
 {error&&<p role="alert" className="text-destructive">{error}</p>}
 {items.map(i=><label key={i.id} className="flex gap-3 rounded border p-3"><input type="checkbox" checked={selected.includes(i.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,i.id]:v.filter(id=>id!==i.id))}/>{i.description}</label>)}
 <label>Staff<select className="block w-full rounded border p-2" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Choose staff</option>{staff.map(s=><option key={s.user_id} value={s.user_id}>{s.display_name||s.email}</option>)}</select></label>
 <label>Route<select className="block w-full rounded border p-2" value={route} onChange={e=>setRoute(e.target.value)}><option value="">Choose route</option>{routes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
 <label>Visit date<input className="block w-full rounded border p-2" type="date" value={day} onChange={e=>setDay(e.target.value)}/></label>
 <Button disabled={busy||!assignee||!route||(items.length>0&&!selected.length)} onClick={assign}>{busy?'Assigning…':'Assign measurement'}</Button>
 </DialogContent></Dialog>;
}
