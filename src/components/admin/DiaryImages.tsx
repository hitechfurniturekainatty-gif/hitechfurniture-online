import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import { Camera, ImagePlus, Loader2, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { diaryDb } from '@/hooks/useDiary';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type Photo = { id: string; storage_path: string; caption: string; created_by: string; url?: string };
export function DiaryImages({ noteId }: { noteId: string }) {
  const { user, isAdmin } = useAuth();
  const picker = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState(''), [selected, setSelected] = useState<Photo | null>(null), [zoom, setZoom] = useState(1);
  const query = useQuery({ queryKey: ['diary-images', user?.id, noteId], refetchInterval: 240_000, queryFn: async () => {
    const { data, error } = await diaryDb.from('staff_diary_images').select('*').eq('note_id', noteId).order('created_at');
    if (error) throw error;
    return Promise.all((data as Photo[]).map(async p => {
      const { data: signed, error: signError } = await supabase.storage.from('staff-diary').createSignedUrl(p.storage_path, 600);
      if (signError) throw signError;
      return { ...p, url: signed?.signedUrl };
    }));
  }});
  const upload = async (files: FileList | null) => {
    if (!files?.length || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if ((query.data?.length ?? 0) + files.length > 10) throw new Error('Use up to 10 photos per note.');
      for (const file of Array.from(files)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo. Convert HEIC to JPG first.');
        if (file.size > 25 * 1024 * 1024) throw new Error('Choose images smaller than 25 MB.');
        setProgress(0);
        const compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2200, useWebWorker: false, fileType: 'image/jpeg', onProgress: setProgress });
        const path = `${noteId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('staff-diary').upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        const { error: rowError } = await diaryDb.from('staff_diary_images').insert({ note_id: noteId, storage_path: path, caption, created_by: user!.id });
        if (rowError) { await supabase.storage.from('staff-diary').remove([path]); throw rowError; }
      }
      setCaption(''); toast.success('Photos added');
      if (picker.current) picker.current.value = '';
      if (camera.current) camera.current.value = '';
    } catch (error) { toast.error((error as Error).message || 'Upload failed. Choose the remaining photos to retry.'); }
    finally { await query.refetch(); lock.current = false; setBusy(false); }
  };
  const remove = async (photo: Photo) => {
    if (lock.current || !window.confirm('Remove this photo?')) return;
    lock.current = true; setBusy(true);
    try {
      const { error } = await supabase.storage.from('staff-diary').remove([photo.storage_path]);
      if (error) throw error;
      const { error: rowError } = await diaryDb.from('staff_diary_images').delete().eq('id', photo.id);
      if (rowError) throw rowError;
      await query.refetch();
    } catch (error) { toast.error((error as Error).message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border bg-white p-4 text-slate-900">
    <div><h3 className="text-sm font-semibold">Photos / ചിത്രങ്ങൾ</h3><p className="text-xs text-slate-500">Private · up to 10 photos · compressed to save storage</p></div>
    {query.isError && <Button variant="outline" onClick={() => query.refetch()}>Retry loading photos</Button>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{query.data?.map(p => <div key={p.id} className="relative overflow-hidden rounded-xl border">
      <button type="button" className="w-full" onClick={() => { setSelected(p); setZoom(1); }}><img src={p.url} alt={p.caption || 'Diary attachment'} className="h-28 w-full object-cover" /><span className="block truncate p-2 text-left text-xs">{p.caption || 'Tap to enlarge'}</span></button>
      {(p.created_by === user?.id || isAdmin) && <button type="button" aria-label="Remove photo" disabled={busy} className="absolute right-1 top-1 rounded-full bg-white p-2 text-red-700" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></button>}
    </div>)}</div>
    <Input aria-label="Photo caption" value={caption} maxLength={300} onChange={e => setCaption(e.target.value)} placeholder="ചിത്രത്തിന്റെ വിവരണം (optional)" />
    <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => upload(e.target.files)} />
    <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e => upload(e.target.files)} />
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || query.isPending || query.isError} onClick={() => picker.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />Gallery</Button><Button type="button" variant="outline" disabled={busy || query.isPending || query.isError} onClick={() => camera.current?.click()}><Camera className="mr-2 h-4 w-4" />Camera</Button>{busy && <span className="flex items-center gap-2 text-xs" role="status"><Loader2 className="h-4 w-4 animate-spin" />Processing {progress}%</span>}</div>
    <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null); }}><DialogContent className="max-w-4xl"><DialogTitle>Photo preview</DialogTitle><DialogDescription>{selected?.caption || 'Zoom to inspect this attachment.'}</DialogDescription><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(1, z - .5))}><ZoomOut /></Button><Button variant="outline" size="icon" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, z + .5))}><ZoomIn /></Button></div><div className="max-h-[65vh] overflow-auto">{selected && <img alt={selected.caption || 'Diary photo'} src={selected.url} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} />}</div></DialogContent></Dialog>
  </section>;
}
