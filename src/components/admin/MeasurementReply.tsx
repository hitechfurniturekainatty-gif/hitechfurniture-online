import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { compressImage } from '@/lib/imageCompression';
import { toast } from '@/hooks/use-toast';
export function MeasurementReply({task,onClose,onSaved}:{task:{id:string;item_ids?:string[];draft_quotation_id:string|null;status:string;completion_note?:string|null}|null;onClose:()=>void;onSaved:()=>void}){
 const [rows,setRows]=useState<any[]>([]),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const savingRef = useRef(false);
 const [loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!task)return;
  let active=true;
  setRows([]);setNote(task.completion_note??'');setError('');setLoading(true);
  const load=async()=>{try{
   const {data,error}=await supabase.from('quotation_items').select('id,description,measurement,measurement_image_url,item_image_url').eq('quotation_id',task.draft_quotation_id!).in('id',task.item_ids??[]);
   if(error)throw error;
   if((data??[]).length!==(task.item_ids??[]).length)throw new Error('Some assigned items could not be loaded. Contact the office before completing this task.');
   if(active)setRows((data??[]).map(r=>({...r,photo:r.measurement_image_url??'',file:null})));
  }catch(e:any){if(active)setError(e.message??'Could not load assigned items');}
  finally{if(active)setLoading(false);}};
  void load();
  return()=>{active=false;};
 },[task,retry]);
 const save=async()=>{if(!task||savingRef.current||loading)return;savingRef.current=true;setBusy(true);setError('');try{
 const replies=[];
 for(const r of rows){let photo=r.photo;
 if(r.file){const file=await compressImage(r.file);const path=`measurement-replies/${task.id}/${crypto.randomUUID()}.jpg`;const {error}=await supabase.storage.from('quotations').upload(path,file,{contentType:file.type});if(error)throw error;photo=supabase.storage.from('quotations').getPublicUrl(path).data.publicUrl;
 // Retain successful uploads when the completion request fails; retry reuses them.
 setRows(current=>current.map(x=>x.id===r.id?{...x,photo,file:null}:x));}
 replies.push({id:r.id,measurement:r.measurement,photo});}
 const {error}=await (supabase as any).rpc('complete_item_measurement',{task_id:task.id,replies,reply_note:note});if(error)throw error;
 toast({title:'Measurement completed',description:'Reply saved to quotation. Office notified.'});onSaved();onClose();
 }catch(e:any){setError(e.message??'Reply not saved');}finally{savingRef.current=false;setBusy(false);}};
 const completed=task?.status==='completed';
 return <Dialog open={!!task} onOpenChange={v=>{if(!v&&!busy)onClose();}}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Measurement reply / അളവുകൾ</DialogTitle><DialogDescription>Enter measurements for assigned items. Photos are optional. Completion sends the reply to the office.</DialogDescription></DialogHeader>
 {loading&&<p>Loading assigned items…</p>}
 {error&&<div role="alert" className="text-destructive"><p>{error}</p>{!rows.length&&<Button variant="outline" disabled={busy||loading} onClick={()=>setRetry(v=>v+1)}>Retry loading</Button>}</div>}
 {rows.map((r,index)=><div key={r.id} className="space-y-2 rounded border p-3"><p className="font-medium">{r.description}</p>{r.item_image_url&&<img src={r.item_image_url} alt={r.description} className="h-24 object-contain"/>}
 <label className="block">Measurement / അളവ്<textarea disabled={completed||busy} className="block w-full rounded border p-2" value={r.measurement??''} onChange={e=>setRows(v=>v.map((x,i)=>i===index?{...x,measurement:e.target.value}:x))}/></label>
 {r.measurement_image_url&&<img src={r.measurement_image_url} alt="Measurement attachment" className="h-32 object-contain"/>}
 {!completed&&<label className="block text-sm">Photo / sketch (optional)<input disabled={busy} type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file&&!file.type.startsWith('image/')){setError('Choose an image');return;}setRows(v=>v.map((x,i)=>i===index?{...x,file}:x));}}/></label>}
 </div>)}
 <label>Reply notes<textarea disabled={completed||busy} className="block w-full rounded border p-2" value={note} onChange={e=>setNote(e.target.value)}/></label>
 {!completed&&<Button disabled={busy||loading||!rows.length||rows.some(r=>!r.measurement?.trim())} onClick={save}>{busy?'Saving…':'Complete & send to office'}</Button>}
 </DialogContent></Dialog>;
}
