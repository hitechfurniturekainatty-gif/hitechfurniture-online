import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, GripVertical, Loader2, ArrowRightLeft } from "lucide-react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type ReorderItem = {
  id: string; product_name: string; product_code: string; cover_url?: string | null;
  kind?: "product" | "variant" | "variant_stock" | "bundle";
  color_label?: string | null; color_hex?: string | null; stock?: number;
  location_id?: string | null; floor_display_order?: number;
};
export type LocationOption = {
  id: string; building: string; floor: string; section: string | null; part?: string | null;
};
const label = (l: LocationOption) => [l.building,l.floor,...new Set([l.section,l.part].filter(Boolean))].join(" / ");
const key = (i: ReorderItem) => (i.kind || "product")+":"+i.id;
const payload = (i: ReorderItem) => ({id:i.id,kind:i.kind||"product",location_id:i.location_id,floor_display_order:i.floor_display_order||0});

function Row({item,index,count,selected,onToggle,onMove,disabled}:{item:ReorderItem;index:number;count:number;selected:boolean;onToggle:()=>void;onMove:(delta:number)=>void;disabled:boolean}) {
  const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id:key(item),disabled});
  return <li ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition,opacity:isDragging?.6:1}} className="flex items-center gap-2 rounded-xl border bg-white p-2 shadow-sm">
    <button ref={setActivatorNodeRef} type="button" disabled={disabled} className="touch-none rounded-lg p-2 text-stone-500 active:cursor-grabbing" aria-label={"Drag "+item.product_name} {...attributes} {...listeners}><GripVertical className="h-5 w-5" /></button>
    <Checkbox checked={selected} onCheckedChange={onToggle} disabled={disabled} aria-label={"Select "+item.product_name} />
    <span className="w-5 shrink-0 text-center text-xs text-stone-500">{index+1}</span>
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-stone-50">{item.cover_url&&<img src={item.cover_url} alt="" loading="lazy" className="h-full w-full object-contain" />}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.product_name}</p><p className="truncate text-[11px] text-stone-500">{item.product_code}{item.color_label?" · "+item.color_label:""} · {item.stock||0} here</p></div>
    <div className="flex shrink-0 flex-col"><Button size="icon" variant="ghost" className="h-8 w-8" disabled={disabled||index===0} aria-label={"Move "+item.product_name+" earlier"} onClick={()=>onMove(-1)}><ChevronUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="h-8 w-8" disabled={disabled||index===count-1} aria-label={"Move "+item.product_name+" later"} onClick={()=>onMove(1)}><ChevronDown className="h-4 w-4" /></Button></div>
  </li>;
}

export function FloorReorderDialog({open,onOpenChange,locationLabel,items:initialItems,onSaved,allLocations=[]}:{open:boolean;onOpenChange:(o:boolean)=>void;locationLabel:string;items:ReorderItem[];onSaved:()=>void;allLocations?:LocationOption[]}) {
  const [items,setItems]=useState<ReorderItem[]>([]);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [target,setTarget]=useState("");
  const [saving,setSaving]=useState(false);
  const [hydrating,setHydrating]=useState(false);
  const token=useRef("");
  const lock=useRef(false);
  const initialRef=useRef(initialItems);
  initialRef.current=initialItems;
  useEffect(()=>{
    if(!open)return;
    let cancelled=false;
    setSelected(new Set());setTarget("");token.current=crypto.randomUUID();
    const rows=initialRef.current;
    if(rows.every(i=>i.location_id!==undefined)){
      setItems(rows);return;
    }
    // Legacy Products callers only supply IDs. Read the persisted position,
    // never guess a section or overwrite an unseen order.
    setHydrating(true);
    Promise.all(rows.map(async i=>{
      const table=i.kind==="variant_stock"?"product_variant_stock":i.kind==="variant"?"product_variants":i.kind==="bundle"?"product_bundles":"products";
      const {data,error}=await (supabase as any).from(table).select("location_id,floor_display_order").eq("id",i.id).single();
      if(error)throw error;
      return {...i,...data};
    })).then(next=>{if(!cancelled)setItems(next);}).catch(e=>{if(!cancelled){setItems([]);toast({title:"Could not load positions",description:e.message,variant:"destructive"});}}).finally(()=>{if(!cancelled)setHydrating(false);});
    return ()=>{cancelled=true;};
  },[open]);
  const sensors=useSensors(useSensor(MouseSensor,{activationConstraint:{distance:5}}),useSensor(TouchSensor,{activationConstraint:{delay:200,tolerance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  const move=(from:number,to:number)=>{if(saving)return;setItems(curr=>arrayMove(curr,from,to));token.current=crypto.randomUUID();};
  const drag=(e:DragEndEvent)=>{
    if(!e.over||e.active.id===e.over.id)return;
    const from=items.findIndex(i=>key(i)===e.active.id),to=items.findIndex(i=>key(i)===e.over!.id);
    if(from>=0&&to>=0)move(from,to);
  };
  const execute=async(action:"arrange"|"move")=>{
    if(lock.current)return;
    const chosen=action==="move"?items.filter(i=>selected.has(key(i))):items;
    if(!chosen.length)return;
    if(action==="arrange"&&(new Set(chosen.map(i=>i.location_id)).size!==1||!chosen[0].location_id)){toast({title:"Choose one section to arrange",variant:"destructive"});return;}
    lock.current=true;setSaving(true);
    try{
      const {error}=await (supabase as any).rpc("save_staff_floor",{p_request_id:token.current,p_action:action,p_items:chosen.map(payload),p_location:action==="move"?target:null});
      if(error)throw error;
      toast({title:action==="arrange"?"Display order saved":"Items moved",description:action==="arrange"?"All staff will see this sequence.":"Total stock is unchanged."});
      onOpenChange(false);onSaved();
    }catch(e){toast({title:"Could not save changes",description:(e as any)?.message,variant:"destructive"});}
    finally{lock.current=false;setSaving(false);}
  };
  return <Dialog open={open} onOpenChange={o=>{if(!saving)onOpenChange(o);}}><DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
    <DialogHeader><DialogTitle>Arrange Display</DialogTitle><p className="text-xs text-muted-foreground">{locationLabel} · First row = first item on your walking route.</p></DialogHeader>
    <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-950">ഐറ്റം പിടിച്ച് നീക്കുക, അല്ലെങ്കിൽ ↑ ↓ ഉപയോഗിക്കുക. Save Arrangement അമർത്തിയാൽ സ്റ്റാഫിന് ഈ ക്രമം ലഭിക്കും.</p>
    {allLocations.length>0&&<div className="space-y-2 rounded-xl border bg-stone-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium"><ArrowRightLeft className="mr-1 inline h-3.5 w-3.5" />Move selected to another location</p><Button size="sm" variant="ghost" disabled={saving} onClick={()=>{setSelected(selected.size===items.length?new Set():new Set(items.map(key)));token.current=crypto.randomUUID();}}>{selected.size===items.length?"Clear all":"Select all"}</Button></div><div className="flex flex-col gap-2 sm:flex-row"><Select value={target} onValueChange={v=>{setTarget(v);token.current=crypto.randomUUID();}} disabled={saving}><SelectTrigger className="bg-white"><SelectValue placeholder="Destination…" /></SelectTrigger><SelectContent>{allLocations.map(l=><SelectItem key={l.id} value={l.id}>{label(l)}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={()=>void execute("move")} disabled={saving||!target||!selected.size||hydrating}>Move {selected.size||""} selected</Button></div></div>}
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {hydrating?<div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>:!items.length?<p className="p-8 text-center text-sm text-muted-foreground">No items to arrange.</p>:<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drag} modifiers={[restrictToVerticalAxis]}><SortableContext items={items.map(key)} strategy={verticalListSortingStrategy}><ul className="space-y-2">{items.map((i,index)=><Row key={key(i)} item={i} index={index} count={items.length} selected={selected.has(key(i))} disabled={saving} onMove={delta=>move(index,index+delta)} onToggle={()=>{setSelected(prev=>{const next=new Set(prev);next.has(key(i))?next.delete(key(i)):next.add(key(i));return next;});token.current=crypto.randomUUID();}} />)}</ul></SortableContext></DndContext>}
    </div>
    <DialogFooter className="border-t pt-3"><Button variant="outline" disabled={saving} onClick={()=>onOpenChange(false)}>Cancel</Button><Button disabled={saving||hydrating||!items.length} onClick={()=>void execute("arrange")} className="bg-amber-200 text-amber-950 hover:bg-amber-300">{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Arrangement</Button></DialogFooter>
  </DialogContent></Dialog>;
}
