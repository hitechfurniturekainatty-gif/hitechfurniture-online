import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/brand";
import { toTitleCase } from "@/lib/textCase";
import { FloorReorderDialog } from "@/components/admin/FloorReorderDialog";
import { floorEntries, sortFloorEntries, locationLabel, partLabel, type FloorProduct, type FloorEntry, type FloorLocation } from "@/lib/staffFloorCatalog";
import { SnapSearchDialog } from "@/components/staff/SnapSearchDialog";
import { Camera, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUpDown, ChevronLeft, ChevronRight, Grid2X2, List, Loader2, MapPin, Package, RefreshCw, Search } from "lucide-react";

const db = supabase as any;
const PRODUCT_FIELDS = "id,product_name,product_code,description,mrp,material,dimensions,primary_image_url,stock_quantity,stock_status,location_id,floor_display_order,main_category_id,sub_category_id,review_status,product_images(image_url,display_order),product_variants(id,color_name,color_hex,image_url,stock_quantity,location_id,floor_display_order,product_variant_stock(id,location_id,quantity,floor_display_order))";
const BUNDLE_FIELDS = "id,name,bundle_code,description,mrp,material,dimensions,main_image_url,stock_status,location_id,floor_display_order,main_category_id,sub_category_id";
type Category = { id: string; name: string };
const ALL = "__all";
const snapshot = (e: FloorEntry) => ({ id: e.refId, kind: e.kind, location_id: e.location_id, floor_display_order: e.floor_display_order });
async function allPages(query: (start: number, end: number) => PromiseLike<{data: unknown[] | null; error: any}>) {
  const rows: any[] = [];
  for (let start=0; ; start+=500) {
    const {data,error} = await query(start,start+499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length<500) return rows;
  }
}

export default function StaffCatalog() {
  const { user, loading: authLoading, isOfficeStaff, isAdmin, isWarehouse, isDelivery, isMeasurementStaff } = useAuth();
  const allowed = !!user && (isOfficeStaff || isWarehouse || isDelivery || isMeasurementStaff);
  const [snapOpen,setSnapOpen]=useState(false);
  const [snapPinOpen,setSnapPinOpen]=useState(false);
  const [snapPin,setSnapPin]=useState("");
  const [verifiedSnapPin,setVerifiedSnapPin]=useState("");
  const [verifyingSnap,setVerifyingSnap]=useState(false);
  const [products,setProducts] = useState<FloorProduct[]>([]);
  const [locations,setLocations] = useState<FloorLocation[]>([]);
  const [categories,setCategories] = useState<Category[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [building,setBuilding] = useState(ALL);
  const [floor,setFloor] = useState(ALL);
  const [section,setSection] = useState(ALL);
  const [category,setCategory] = useState(ALL);
  const [stockView,setStockView] = useState("available");
  const [search,setSearch] = useState("");
  const [reverse,setReverse] = useState(false);
  const [listView,setListView] = useState(false);
  const [arrangeOpen,setArrangeOpen] = useState(false);
  const [viewerKey,setViewerKey] = useState<string | null>(null);
  const [moveEntries,setMoveEntries] = useState<FloorEntry[]>([]);
  const [selected,setSelected] = useState<Set<string>>(new Set());
  const [selecting,setSelecting] = useState(false);
  const [stockEntry,setStockEntry] = useState<FloorEntry | null>(null);
  const [loadedAt,setLoadedAt] = useState<Date | null>(null);
  const revision = useRef(0);
  const busy = useRef(false);
  const interacting = useRef(false);
  interacting.current=snapOpen||snapPinOpen||arrangeOpen||moveEntries.length>0||!!stockEntry||selecting||!!viewerKey;
  const load = useCallback(async () => {
    if (!allowed || busy.current) return;
    busy.current = true;
    const ticket = ++revision.current;
    setLoading(true);
    setError("");
    try {
      const [ps,bs,ls,cs] = await Promise.all([
        allPages((start,end)=>db.from("products").select(PRODUCT_FIELDS).is("deleted_at",null).order("id").range(start,end)),
        allPages((start,end)=>db.from("product_bundles").select(BUNDLE_FIELDS).is("deleted_at",null).order("id").range(start,end)),
        allPages((start,end)=>db.from("product_locations").select("id,building,floor,section,part").eq("is_active",true).order("display_order").order("id").range(start,end)),
        allPages((start,end)=>db.from("main_categories").select("id,name").is("deleted_at",null).order("display_order").order("id").range(start,end)),
      ]);
      if (ticket !== revision.current) return;
      const bundles = bs.map(b => ({
        ...b, product_name:b.name, product_code:b.bundle_code, primary_image_url:b.main_image_url,
        stock_quantity:b.stock_status==="out_of_stock"?0:1, is_bundle:true, product_images:[], product_variants:[],
      }));
      setProducts([...ps,...bundles] as FloorProduct[]);
      setLocations(ls as FloorLocation[]);
      setCategories(cs as Category[]);
      setLoadedAt(new Date());
    } catch (e) {
      if (ticket===revision.current) setError(e instanceof Error ? e.message : (e as any)?.message || "Could not load Staff Catalog");
    } finally {
      busy.current=false;
      if (ticket===revision.current) setLoading(false);
    }
  },[allowed,user?.id]);
  useEffect(()=>{
    void load();
    const refresh=()=>{if(!document.hidden&&!interacting.current) void load();};
    const timer=window.setInterval(refresh,60_000);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    return ()=>{revision.current++;busy.current=false;window.clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[load]);
  const buildings = useMemo(()=>[...new Set(locations.map(l=>l.building))],[locations]);
  const floors = useMemo(()=>[...new Set(locations.filter(l=>building===ALL||l.building===building).map(l=>l.floor))],[locations,building]);
  const sections = useMemo(()=>locations.filter(l=>(building===ALL||l.building===building)&&(floor===ALL||l.floor===floor)),[locations,building,floor]);
  const entries = useMemo(()=>sortFloorEntries(floorEntries(products),locations),[products,locations]);
  const inScope = useCallback((e:FloorEntry)=>{
    if(section!==ALL) return e.location_id===section;
    const loc=locations.find(l=>l.id===e.location_id);
    return (building===ALL||loc?.building===building)&&(floor===ALL||loc?.floor===floor);
  },[locations,building,floor,section]);
  const sectionEntries = useMemo(()=>entries.filter(e=>e.location_id===section),[entries,section]);
  const shown = useMemo(()=>{
    const q=search.trim().toLowerCase();
    const rows=entries.filter(e=>{
      if(!inScope(e)) return false;
      if(category!==ALL&&e.product.main_category_id!==category) return false;
      const available=e.stock>0&&e.product.stock_status!=="out_of_stock";
      if(stockView==="available"&&!available||stockView==="out"&&available) return false;
      return !q||[e.product.product_name,e.product.product_code,e.variant?.color_name].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    return reverse ? rows.reverse() : rows;
  },[entries,inScope,category,stockView,search,reverse]);
  const scopeLabel = section!==ALL ? locationLabel(locations.find(l=>l.id===section))
    : [building===ALL?"All locations":building,floor===ALL?null:floor].filter(Boolean).join(" / ");
  const viewerIndex=shown.findIndex(e=>e.key===viewerKey);
  const viewed=viewerIndex<0?null:shown[viewerIndex];
  useEffect(()=>{setSelected(new Set());setSelecting(false);setViewerKey(null);},[building,floor,section,search,category,stockView,reverse]);
  useEffect(()=>{
    if(section!==ALL&&!sections.some(l=>l.id===section)) setSection(ALL);
  },[sections,section]);
  const updated = async () => {
    setSelected(new Set());setSelecting(false);setViewerKey(null);
    await load();
  };
  const selectedRows=shown.filter(e=>selected.has(e.key));

  if(authLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if(!user) return <Navigate to="/auth" replace />;
  if(!allowed) return <Navigate to="/admin" replace />;

  return <AdminShell>
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/catalog" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-stone-600"><ArrowLeft className="h-3.5 w-3.5" /> Catalog</Link>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-amber-100 p-2.5 text-amber-900"><Package className="h-5 w-5" /></span>
              <div><h1 className="font-display text-2xl font-semibold text-stone-900">Staff Catalog</h1><p className="text-xs text-stone-600 sm:text-sm">ഷോറൂമിലെ ക്രമത്തിൽ · Floor-wise items & MRP</p></div>
            </div>
          </div>
          {isOfficeStaff&&<Button variant="outline" size="sm" onClick={()=>verifiedSnapPin?setSnapOpen(true):setSnapPinOpen(true)} className="bg-white"><Camera className="mr-1.5 h-4 w-4" />SnapSearch</Button>}
          <Button variant="outline" size="sm" onClick={()=>void load()} disabled={loading} className="bg-white"><RefreshCw className={"mr-1.5 h-4 w-4 "+(loading?"animate-spin":"")} /> Refresh</Button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Picker label="Shop / Godown" value={building} onChange={v=>{setBuilding(v);setFloor(ALL);setSection(ALL);}} options={buildings.map(b=>({id:b,label:b}))} allLabel="All locations" />
          <Picker label="Floor" value={floor} onChange={v=>{setFloor(v);setSection(ALL);}} options={floors.map(f=>({id:f,label:f}))} allLabel="All floors" />
          <Picker label="Section / Part" value={section} onChange={setSection} options={sections.map(l=>({id:l.id,label:partLabel(l)+(building===ALL||floor===ALL?" · "+l.building+" · "+l.floor:"")}))} allLabel="All sections" />
        </div>
      </div>
      <Card className="rounded-2xl border-stone-200 shadow-sm"><CardContent className="space-y-3 p-3 sm:p-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, code or colour…" aria-label="Search Staff Catalog" className="h-11 rounded-xl pl-9" /></div>
        <div className="grid grid-cols-2 gap-2">
          <Picker label="Category" value={category} onChange={setCategory} options={categories.map(c=>({id:c.id,label:toTitleCase(c.name)}))} allLabel="All categories" />
          <Picker label="Stock" value={stockView} onChange={setStockView} options={[{id:"available",label:"Available now"},{id:"out",label:"Out of stock"},{id:"all",label:"All items"}]} />
        </div>
      </CardContent></Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-semibold text-stone-800">{scopeLabel}</p><p className="text-xs text-muted-foreground">{shown.length} items{loadedAt?" · Updated "+loadedAt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):""}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={()=>setReverse(v=>!v)} aria-pressed={reverse}><ArrowRightLeft className="mr-1.5 h-4 w-4" />{reverse?"Reverse order":"Forward order"}</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={()=>setListView(v=>!v)} aria-label={listView?"Show grid":"Show list"}>{listView?<Grid2X2 className="h-4 w-4" />:<List className="h-4 w-4" />}</Button>
          {isAdmin&&<Button size="sm" variant="outline" onClick={()=>setSelecting(v=>!v)} disabled={loading}>{selecting?"Done selecting":"Select to move"}</Button>}
          {isAdmin&&<Button size="sm" className="bg-amber-200 text-amber-950 hover:bg-amber-300" onClick={()=>setArrangeOpen(true)} disabled={loading||section===ALL||!sectionEntries.length}><ArrowUpDown className="mr-1.5 h-4 w-4" /> Arrange Display</Button>}
        </div>
      </div>
      {isAdmin&&section===ALL&&<p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">ക്രമം മാറ്റാൻ ഒരു Section / Part തിരഞ്ഞെടുക്കുക. “General” ഫ്ലോറിലെ പൊതുഭാഗമാണ്.</p>}
      {selecting&&<div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm">
        <span className="text-sm font-medium">{selectedRows.length} selected</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>setSelected(new Set(shown.map(e=>e.key)))}>Select all</Button><Button size="sm" onClick={()=>setMoveEntries(selectedRows)} disabled={!selectedRows.length}>Move selected <ArrowRight className="ml-1 h-4 w-4" /></Button></div>
      </div>}
      {error?<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5"><p className="font-medium text-red-900">Catalog could not be loaded</p><p className="mt-1 text-sm text-red-800">{error}</p><Button className="mt-3" onClick={()=>void load()}>Try again</Button></div>
      :loading?<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({length:6},(_,i)=><div key={i} className="h-64 animate-pulse rounded-2xl bg-stone-100" />)}</div>
      :!shown.length?<div className="rounded-2xl border border-dashed bg-white p-8 text-center"><Package className="mx-auto h-8 w-8 text-stone-400" /><p className="mt-3 font-medium">No items in this view</p><p className="mt-1 text-sm text-muted-foreground">Check the floor, section or stock filter.</p><Button variant="outline" className="mt-3" onClick={()=>{setSearch("");setCategory(ALL);setStockView("all");}}>Show all items here</Button></div>
      :<div className={listView?"space-y-3":"grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"}>
        {shown.map((e,i)=><EntryCard key={e.key} entry={e} location={locations.find(l=>l.id===e.location_id)} index={i} list={listView} selecting={selecting} selected={selected.has(e.key)} onSelect={()=>setSelected(prev=>{const next=new Set(prev);next.has(e.key)?next.delete(e.key):next.add(e.key);return next;})} onOpen={()=>setViewerKey(e.key)} />)}
      </div>}
    </div>
    <FloorReorderDialog open={arrangeOpen&&isAdmin} onOpenChange={setArrangeOpen} locationLabel={scopeLabel} items={sectionEntries.map(e=>({id:e.refId,kind:e.kind,product_name:e.product.product_name,product_code:e.product.product_code,cover_url:e.cover,color_label:e.variant?.color_name,stock:e.stock,location_id:e.location_id,floor_display_order:e.floor_display_order}))} onSaved={()=>void updated()} allLocations={locations} />
    <Dialog open={!!viewed} onOpenChange={o=>{if(!o)setViewerKey(null);}}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>{viewed?toTitleCase(viewed.product.product_name):"Item"}</DialogTitle></DialogHeader>
        {viewed&&<>
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-stone-50">{viewed.cover?<img src={viewed.cover} alt={viewed.product.product_name} className="h-full w-full object-contain" />:<Package className="h-12 w-12 text-stone-300" />}<Badge className="absolute left-2 top-2 bg-white text-stone-800">{viewerIndex+1} / {shown.length}</Badge></div>
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">MRP</p><p className="font-display text-2xl font-semibold text-stone-900">{formatINR(viewed.product.mrp)}</p></div><Badge variant="outline">{viewed.product.is_bundle?(viewed.stock>0?"Set available":"Set unavailable"):viewed.stock+" here"}</Badge></div>
          <p className="text-sm text-muted-foreground">{viewed.product.product_code}{viewed.variant?" · "+viewed.variant.color_name:""}</p>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{locationLabel(locations.find(l=>l.id===viewed.location_id))}</p>
          {viewed.product.description&&<p className="whitespace-pre-line text-sm">{viewed.product.description}</p>}
          {(viewed.product.material||viewed.product.dimensions)&&<p className="text-xs text-muted-foreground">{[viewed.product.material,viewed.product.dimensions].filter(Boolean).join(" · ")}</p>}
          {isAdmin&&<div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={()=>setMoveEntries([viewed])}><MapPin className="mr-1.5 h-4 w-4" /> Move location</Button>{viewed.kind==="bundle"?<Button variant="outline" asChild><Link to={"/admin/bundles/"+viewed.refId}>Manage set stock</Link></Button>:<Button variant="outline" onClick={()=>setStockEntry(viewed)}>Stock In / Out</Button>}</div>}
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-background pt-3"><Button variant="outline" disabled={viewerIndex<=0} onClick={()=>setViewerKey(shown[viewerIndex-1].key)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button disabled={viewerIndex>=shown.length-1} onClick={()=>setViewerKey(shown[viewerIndex+1].key)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
        </>}
      </DialogContent>
    </Dialog>
    <MoveDialog entries={moveEntries} locations={locations} onClose={()=>setMoveEntries([])} onSaved={updated} />
    <SnapSearchDialog open={snapOpen} onOpenChange={setSnapOpen} catalogPin={verifiedSnapPin} />
    <Dialog open={snapPinOpen} onOpenChange={o=>{if(!verifyingSnap){setSnapPinOpen(o);if(!o)setSnapPin("");}}}><DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle>SnapSearch access</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Photo search uses the existing Catalog PIN. Floor browsing opens with your staff login.</p><Input type="password" value={snapPin} onChange={e=>setSnapPin(e.target.value)} placeholder="Photo search PIN" aria-label="Photo search PIN" /><Button disabled={!snapPin||verifyingSnap} onClick={async()=>{setVerifyingSnap(true);try{const {data,error}=await supabase.rpc("verify_catalog_pin",{_pin:snapPin});if(error||!data){toast({title:"Wrong PIN",variant:"destructive"});return;}setVerifiedSnapPin(snapPin);setSnapPin("");setSnapPinOpen(false);setSnapOpen(true);}finally{setVerifyingSnap(false);}}}>{verifyingSnap&&<Loader2 className="mr-2 h-4 w-4 animate-spin" />}Open photo search</Button></DialogContent></Dialog>
    <FloorStockDialog entry={stockEntry} onClose={()=>setStockEntry(null)} onSaved={updated} />
  </AdminShell>;
}

function Picker({label,value,onChange,options,allLabel}:{label:string;value:string;onChange:(v:string)=>void;options:{id:string;label:string}[];allLabel?:string}) {
  return <div className="min-w-0 space-y-1.5"><Label className="text-xs text-stone-600">{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="h-11 rounded-xl bg-white" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{allLabel&&<SelectItem value={ALL}>{allLabel}</SelectItem>}{options.map(o=><SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>;
}
function EntryCard({entry:e,location,index,list,selecting,selected,onSelect,onOpen}:{entry:FloorEntry;location?:FloorLocation;index:number;list:boolean;selecting:boolean;selected:boolean;onSelect:()=>void;onOpen:()=>void}) {
  return <Card className={"relative overflow-hidden rounded-2xl border-stone-200 bg-white shadow-sm transition hover:border-amber-300 "+(selected?"ring-2 ring-amber-400":"")}>
    {selecting&&<div className="absolute right-2 top-2 z-10 rounded-lg bg-white p-2"><Checkbox checked={selected} onCheckedChange={onSelect} aria-label={"Select "+e.product.product_name} /></div>}
    <button type="button" className={"w-full text-left "+(list?"flex items-center":"")} onClick={selecting?onSelect:onOpen} aria-label={"Open "+e.product.product_name}>
      <div className={"relative flex shrink-0 items-center justify-center bg-stone-50 "+(list?"h-28 w-28":"aspect-[4/3]")}>{e.cover?<img src={e.cover} alt="" loading="lazy" className="h-full w-full object-contain p-2" />:<Package className="h-8 w-8 text-stone-300" />}<span className="absolute left-2 top-2 rounded-full border bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-stone-700">{index+1}</span></div>
      <div className="min-w-0 flex-1 space-y-1.5 p-3"><p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900">{toTitleCase(e.product.product_name)}</p><p className="truncate text-[11px] text-stone-500">{e.product.product_code}{e.variant?" · "+e.variant.color_name:""}</p><p className="font-display text-lg font-semibold text-stone-900">{formatINR(e.product.mrp)} <span className="font-sans text-[10px] font-normal text-stone-500">MRP</span></p><div className="flex flex-wrap gap-1"><span className={"rounded-md px-2 py-1 text-[10px] font-medium "+(e.stock>0&&e.product.stock_status!=="out_of_stock"?"bg-emerald-50 text-emerald-800":"bg-stone-100 text-stone-600")}>{e.product.is_bundle?(e.stock>0?"Set available":"Unavailable"):e.stock+" here"}</span>{!e.floor_display_order&&<span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-900">To arrange</span>}</div><p className="line-clamp-2 text-[10px] text-stone-500">{locationLabel(location)}</p></div>
    </button>
  </Card>;
}

function MoveDialog({entries,locations,onClose,onSaved}:{entries:FloorEntry[];locations:FloorLocation[];onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [target,setTarget]=useState("");
  const [saving,setSaving]=useState(false);
  const token=useRef("");
  const lock=useRef(false);
  useEffect(()=>{setTarget("");token.current=crypto.randomUUID();},[entries]);
  const save=async()=>{
    if(lock.current||!target) return;
    lock.current=true;setSaving(true);
    try {
      const {error}=await db.rpc("save_staff_floor",{p_request_id:token.current,p_action:"move",p_items:entries.map(snapshot),p_location:target});
      if(error)throw error;
      toast({title:"Location updated",description:"Total stock is unchanged."});
      onClose();await onSaved();
    }catch(e){toast({title:"Could not move items",description:(e as any)?.message,variant:"destructive"});}
    finally{lock.current=false;setSaving(false);}
  };
  return <Dialog open={entries.length>0} onOpenChange={o=>{if(!o&&!saving)onClose();}}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle>Move {entries.length} {entries.length===1?"item":"items"}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">സാധനം മാറ്റിവെക്കുന്ന സ്ഥലം തിരഞ്ഞെടുക്കുക. ഇത് Stock Out അല്ല.</p><Picker label="Destination" value={target} onChange={v=>{setTarget(v);token.current=crypto.randomUUID();}} options={locations.filter(l=>!entries.every(e=>e.location_id===l.id)).map(l=>({id:l.id,label:locationLabel(l)}))} /><DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={()=>void save()} disabled={saving||!target}>{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin" />}Move items</Button></DialogFooter></DialogContent></Dialog>;
}

function FloorStockDialog({entry,onClose,onSaved}:{entry:FloorEntry|null;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [direction,setDirection]=useState("in");
  const [quantity,setQuantity]=useState("1");
  const [reason,setReason]=useState("purchase");
  const [note,setNote]=useState("");
  const [saving,setSaving]=useState(false);
  const token=useRef("");
  const lock=useRef(false);
  useEffect(()=>{setDirection("in");setQuantity("1");setReason("purchase");setNote("");token.current=crypto.randomUUID();},[entry]);
  const change=()=>{token.current=crypto.randomUUID();};
  const save=async()=>{
    if(!entry||lock.current)return;
    const qty=Number(quantity);
    if(!Number.isSafeInteger(qty)||qty<1||qty>1000000||(direction==="out"&&qty>entry.stock)){toast({title:"Enter a valid quantity within available stock",variant:"destructive"});return;}
    lock.current=true;setSaving(true);
    try{
      const {error}=await db.rpc("adjust_staff_floor_stock",{p_request_id:token.current,p_kind:entry.kind,p_id:entry.refId,p_change:direction==="out"?-qty:qty,p_expected:entry.stock,p_reason:reason,p_note:note.trim()||null});
      if(error)throw error;
      toast({title:direction==="out"?"Stock removed":"Stock added"});
      onClose();await onSaved();
    }catch(e){toast({title:"Could not update stock",description:(e as any)?.message,variant:"destructive"});}
    finally{lock.current=false;setSaving(false);}
  };
  const reasons=direction==="in"?[{id:"purchase",label:"Purchase / received"},{id:"production",label:"Production completed"},{id:"return",label:"Customer return"},{id:"adjustment",label:"Count correction"}]:[{id:"sale",label:"Sale / dispatch"},{id:"damage",label:"Damage"},{id:"adjustment",label:"Count correction"}];
  return <Dialog open={!!entry} onOpenChange={o=>{if(!o&&!saving)onClose();}}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle>Stock In / Out</DialogTitle></DialogHeader><p className="text-sm">{entry?.product.product_name}{entry?.variant?" · "+entry.variant.color_name:""} · <strong>{entry?.stock} here</strong></p><Picker label="Action" value={direction} onChange={v=>{setDirection(v);setReason(v==="in"?"purchase":"sale");change();}} options={[{id:"in",label:"Stock In"},{id:"out",label:"Stock Out"}]} /><div className="space-y-1.5"><Label htmlFor="floor-stock-qty">Quantity</Label><Input id="floor-stock-qty" type="number" min="1" step="1" inputMode="numeric" value={quantity} onChange={e=>{setQuantity(e.target.value);change();}} disabled={saving} /></div><Picker label="Reason" value={reason} onChange={v=>{setReason(v);change();}} options={reasons} /><Input value={note} onChange={e=>{setNote(e.target.value);change();}} placeholder="Note / invoice number (optional)" aria-label="Stock note" /><p className="text-xs text-muted-foreground">സ്ഥലം മാറ്റാൻ “Move location” ഉപയോഗിക്കുക. ഡെലിവറിയിൽ സ്റ്റോക്ക് ഇതിനകം കുറച്ചിട്ടുണ്ടെങ്കിൽ വീണ്ടും Stock Out ചെയ്യരുത്.</p><DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={()=>void save()} disabled={saving}>{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Stock {direction==="in"?"In":"Out"}</Button></DialogFooter></DialogContent></Dialog>;
}
