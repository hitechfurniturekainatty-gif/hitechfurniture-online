import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, Search, CalendarDays, Check, Pin, Pencil, Trash2, ArrowUpRight, Bell, LockKeyhole, ClipboardList, Sparkles, RotateCcw, Loader2, AlertTriangle, Clock, CircleCheck, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { AdminShell } from '@/components/admin/AdminShell';
import { DiaryImages } from '@/components/admin/DiaryImages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { diaryDb, useDiary } from '@/hooks/useDiary';
import { DiaryNote, DiaryTab, diaryMatches, diaryTabs, reminderDue, reminderInput, reminderISO } from '@/lib/diary';
import { cn } from '@/lib/utils';

type Draft = { title: string; body: string; due_date: string; reminder: string; priority: DiaryNote['priority']; owner_id: string; kind: DiaryNote['kind'] };
const emptyDraft = (): Draft => ({ title: '', body: '', due_date: '', reminder: '', priority: 'normal', owner_id: '', kind: 'personal' });
export default function AdminDiary() {
  const { user, loading, isStaff } = useAuth();
  if (loading) return <div className="p-10"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isStaff) return <Navigate to="/admin" replace />;
  return <DiaryWorkspace key={user.id} />;
}
function DiaryWorkspace() {
  const { user, isAdmin, isWorker, isOfficeStaff } = useAuth();
  const { notes, tasks, now, today, refresh, isPending, isError, refetch } = useDiary();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<DiaryTab>('today'), [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [search, setSearch] = useState(''), [date, setDate] = useState('');
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<DiaryNote | null>(null);
  const [draft, setDraft] = useState(emptyDraft), [busy, setBusy] = useState(false);
  const lock = useRef(false), openedLink = useRef('');
  const roster = useQuery({ queryKey: ['diary-roster', user!.id], enabled: isAdmin, queryFn: async () => {
    const [p, r] = await Promise.all([diaryDb.from('profiles').select('user_id,display_name,email'), diaryDb.from('user_roles').select('user_id')]);
    if (p.error || r.error) throw p.error || r.error;
    const ids = new Set(r.data.map((x: { user_id: string }) => x.user_id));
    return (p.data as { user_id: string; display_name: string; email: string }[]).filter(x => ids.has(x.user_id));
  }});
  const mine = notes.filter(n => n.owner_id === user!.id);
  const visibleNotes = scope === 'team' ? notes.filter(n => n.kind === 'assignment') : mine;
  const visibleTasks = scope === 'mine' ? tasks : [];
  const dateFor = (n: DiaryNote) => n.due_date || (n.reminder_at ? reminderInput(n.reminder_at).slice(0, 10) : null);
  const filter = (due: string | null, completed: boolean, text: string) =>
    diaryMatches(due, completed, date ? (tab === 'completed' ? 'completed' : 'all') : tab, today)
    && (!date || due === date) && text.toLowerCase().includes(search.toLowerCase());
  const filteredNotes = visibleNotes.filter(n => filter(dateFor(n), n.status === 'completed', n.title + ' ' + n.body) || (!date && tab === 'today' && reminderDue(n, now) && (n.title + ' ' + n.body).toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.priority === 'important') - Number(a.priority === 'important') || (dateFor(a) || '9999').localeCompare(dateFor(b) || '9999'));
  const filteredTasks = visibleTasks.filter(t => filter(t.due_date, t.completed, t.title + ' ' + (t.body || '')));
  const dated = [...mine.map(n => ({ due: dateFor(n), done: n.status === 'completed' })), ...tasks.map(t => ({ due: t.due_date, done: t.completed }))];
  const todayItems = dated.filter(n => n.due === today), doneToday = todayItems.filter(n => n.done).length;
  const overdue = dated.filter(n => n.due && n.due < today && !n.done).length;
  const upcoming = dated.filter(n => n.due && n.due > today && !n.done).length;
  const name = user?.email?.split('@')[0] || 'Team';
  const writable = !editing || editing.kind === 'personal' || isAdmin;
  const openNote = useCallback(async (n: DiaryNote) => {
    setEditing(n); setDraft({ title: n.title, body: n.body, due_date: n.due_date || '', reminder: reminderInput(n.reminder_at), priority: n.priority, owner_id: n.owner_id, kind: n.kind }); setOpen(true);
    if (n.owner_id === user!.id && n.kind === 'assignment' && !n.read_at) {
      const { data: readNote, error } = await diaryDb.from('staff_diary_notes').update({ read_at: new Date().toISOString() }).eq('id', n.id).eq('revision', n.revision).select('*').maybeSingle();
      if (error) toast.error('Could not mark this instruction as read.');
      else { if (readNote) setEditing(readNote); await refresh(); }
    }
  }, [user, refresh]);
  useEffect(() => {
    const id = params.get('note');
    if (id && id !== openedLink.current) {
      const note = notes.find(n => n.id === id);
      if (note) { openedLink.current = id; void openNote(note); }
    }
  }, [params, notes, openNote]);
  const change = async (note: DiaryNote, patch: Partial<DiaryNote>, undo = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { data, error } = await diaryDb.from('staff_diary_notes').update(patch).eq('id', note.id).eq('revision', note.revision).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('This note changed elsewhere. Refresh and try again.');
      await refresh();
      if (undo) toast.success('Moved to completed', { action: { label: 'Undo', onClick: async () => {
        const { data: current, error: e } = await diaryDb.from('staff_diary_notes').select('*').eq('id', note.id).single();
        if (e) return toast.error(e.message);
        if (current.status === 'completed' && !current.deleted_at) await change(current, { status: 'pending' });
      } } });
    } catch (error) { toast.error((error as Error).message); await refresh(); }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current || !writable) return;
    if (!draft.title.trim()) return toast.error('Add a title.');
    if (draft.kind === 'assignment' && !draft.owner_id) return toast.error('Choose a staff member.');
    lock.current = true; setBusy(true);
    try {
      const payload = { title: draft.title.trim(), body: draft.body, due_date: draft.due_date || null, reminder_at: reminderISO(draft.reminder), priority: draft.priority };
      const request = editing
        ? diaryDb.from('staff_diary_notes').update(payload).eq('id', editing.id).eq('revision', editing.revision)
        : diaryDb.from('staff_diary_notes').insert({ ...payload, owner_id: draft.kind === 'assignment' ? draft.owner_id : user!.id, created_by: user!.id, kind: draft.kind });
      const { data, error } = await request.select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('This note changed elsewhere. Reopen it and try again.');
      setEditing(data); await refresh(); toast.success('Saved. You can add photos below.');
    } catch (error) { toast.error((error as Error).message); }
    finally { lock.current = false; setBusy(false); }
  };
  const dayLabel = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  const content = <div className="diary-workspace space-y-5">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[30px] border-white/5" />
      <div className="relative flex flex-wrap items-start justify-between gap-4"><div><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-teal-100"><BookOpen className="h-4 w-4" /> Your everyday companion</p><h1 style={{ color: "white" }} className="text-3xl font-semibold sm:text-4xl">My Diary <span className="block pt-2 text-base font-normal text-teal-100">എന്റെ ഡയറി</span></h1><p className="mt-4 text-sm text-teal-50">Hello, {name} · {dayLabel(today)}</p></div>
      <Button className="rounded-xl bg-amber-300 text-teal-950 hover:bg-amber-200" onClick={() => { setEditing(null); setDraft(emptyDraft()); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />പുതിയ കുറിപ്പ്</Button></div>
      <div className="relative mt-6 max-w-md"><div className="mb-2 flex justify-between text-xs"><span>ഇന്നത്തെ പുരോഗതി</span><span>{doneToday} / {todayItems.length} completed</span></div><div role="progressbar" aria-label="Today's progress" aria-valuenow={doneToday} aria-valuemax={todayItems.length || 1} aria-valuemin={0} className="h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-amber-300 transition-all motion-reduce:transition-none" style={{ width: `${todayItems.length ? doneToday / todayItems.length * 100 : 0}%` }} /></div></div>
    </section>
    <div className="grid grid-cols-3 gap-2 sm:gap-4">{[
      { label: 'ഇന്ന്', value: todayItems.length - doneToday, icon: Clock, tone: 'bg-amber-50 text-amber-900 border-amber-200', tab: 'today' },
      { label: 'ബാക്കിയുള്ളത്', value: overdue, icon: AlertTriangle, tone: 'bg-rose-50 text-rose-900 border-rose-200', tab: 'overdue' },
      { label: 'വരാനിരിക്കുന്നത്', value: upcoming, icon: CalendarDays, tone: 'bg-sky-50 text-sky-900 border-sky-200', tab: 'upcoming' },
    ].map(s => <button key={s.tab} onClick={() => { setScope('mine'); setDate(''); setTab(s.tab as DiaryTab); }} className={cn('rounded-2xl border p-3 text-left sm:p-5', s.tone)}><s.icon className="mb-2 h-5 w-5" /><p className="text-2xl font-semibold">{s.value}</p><p className="mt-1 break-words text-[10px] leading-relaxed sm:text-sm">{s.label}</p></button>)}</div>
    {isAdmin && <div className="flex flex-wrap gap-2"><Button variant={scope === 'mine' ? 'default' : 'outline'} onClick={() => setScope('mine')}><LockKeyhole className="mr-2 h-4 w-4" />My diary</Button><Button variant={scope === 'team' ? 'default' : 'outline'} onClick={() => { setScope('team'); setTab('all'); setDate(''); }}><ClipboardList className="mr-2 h-4 w-4" />Team instructions</Button></div>}
    <section className="space-y-4 rounded-2xl border bg-white p-4 text-slate-900 sm:p-5">
      <div className="flex flex-wrap gap-3"><div className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input aria-label="Search diary" placeholder="കുറിപ്പുകൾ തിരയുക…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><Input type="date" aria-label="Filter by date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />{date && <Button variant="ghost" onClick={() => setDate('')}>Clear date</Button>}</div>
      <div className="flex gap-2 overflow-x-auto pb-1">{week.map(d => <button key={d} onClick={() => { setDate(d); if (tab === 'completed') setTab('all'); }} className={cn('min-w-[64px] rounded-xl border px-3 py-2 text-center', (date === d || (!date && tab === 'today' && d === today)) ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-100 bg-slate-50')}><span className="block text-[10px] uppercase">{new Date(`${d}T12:00:00Z`).toLocaleDateString('en', { weekday: 'short' })}</span><span className="text-lg font-semibold">{d.slice(-2)}</span></button>)}</div>
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Diary filters" style={{ background: "transparent", flexWrap: "nowrap", padding: 0 }}>{diaryTabs.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setDate(''); }} className={cn('shrink-0 rounded-full px-4 py-2 text-xs font-medium', tab === t.id ? 'bg-teal-100 text-teal-950' : 'bg-slate-50 text-slate-600')}>{t.label}</button>)}</div>
    </section>
    {isPending && <p role="status" className="flex items-center gap-2 p-5"><Loader2 className="h-5 w-5 animate-spin" />Loading diary…</p>}
    {isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5"><p>Diary could not load. Your saved notes have not been changed.</p><Button variant="outline" className="mt-3" onClick={() => refetch()}>Retry</Button></div>}
    {!isPending && !isError && <div className="grid gap-4 lg:grid-cols-2">{filteredNotes.map(n => {
      const completed = n.status === 'completed', due = dateFor(n), late = !completed && due && due < today;
      const tone = completed ? 'border-emerald-200 bg-emerald-50' : late ? 'border-rose-200 bg-rose-50' : due === today ? 'border-amber-200 bg-amber-50' : n.kind === 'assignment' ? 'border-sky-200 bg-sky-50' : 'border-violet-200 bg-violet-50';
      const Icon = completed ? CircleCheck : n.kind === 'assignment' ? ClipboardList : BookOpen;
      return <article key={n.id} className={cn('flex flex-col rounded-2xl border p-5 text-slate-900 shadow-sm', tone)}>
        <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-medium"><Icon className="h-4 w-4" />{n.kind === 'assignment' ? 'Admin നിർദേശം' : 'സ്വന്തം കുറിപ്പ്'}</span><button disabled={busy} aria-label={n.pinned ? 'Unpin note' : 'Pin note'} onClick={() => change(n, { pinned: !n.pinned })} className={cn('rounded-lg p-2', n.pinned && 'bg-white shadow-sm')}><Pin className={cn('h-4 w-4', n.pinned && 'fill-current')} /></button></div>
        <button className="text-left" onClick={() => openNote(n)}><h2 className={cn('break-words text-lg font-semibold', completed && 'text-slate-500 line-through')}>{n.title}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 line-clamp-3">{n.body || 'വിവരങ്ങളും ചിത്രങ്ങളും തുറക്കുക'}</p></button>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">{due && <span className="rounded-full bg-white/80 px-2 py-1">{late ? '⚠ Overdue · ' : ''}{dayLabel(due)}</span>}{n.priority === 'important' && <span className="rounded-full bg-amber-200 px-2 py-1">★ പ്രധാനപ്പെട്ടത്</span>}{n.kind === 'assignment' && !n.read_at && <span className="rounded-full bg-sky-200 px-2 py-1">പുതിയ നിർദേശം</span>}{reminderDue(n, now) && <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1"><Bell className="h-3 w-3" />Reminder</span>}</div>
        {scope === 'team' && <p className="mt-3 text-xs text-slate-600">To: {roster.data?.find(p => p.user_id === n.owner_id)?.display_name || roster.data?.find(p => p.user_id === n.owner_id)?.email || 'Staff'}</p>}
        {n.completed_at && <p className="mt-3 text-xs text-emerald-800">Completed {new Date(n.completed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4"><Button size="sm" disabled={busy} variant={completed ? 'outline' : 'default'} className={!completed ? 'bg-teal-800 text-white hover:bg-teal-700' : ''} onClick={() => change(n, { status: completed ? 'pending' : 'completed' }, !completed)}>{completed ? <RotateCcw className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}{completed ? 'വീണ്ടും തുറക്കുക' : 'പൂർത്തിയായി'}</Button><Button variant="ghost" size="sm" onClick={() => openNote(n)}><Pencil className="mr-1 h-4 w-4" />Open</Button>{(n.kind === 'personal' || isAdmin) && <Button variant="ghost" size="icon" aria-label="Delete note" disabled={busy} className="ml-auto text-red-700" onClick={() => { if (window.confirm('Remove this note from your diary? Completed notes can stay in history instead.')) void change(n, { deleted_at: new Date().toISOString() }); }}><Trash2 className="h-4 w-4" /></Button>}</div>
      </article>;
    })}{filteredTasks.map(t => <article key={`${t.source}:${t.id}`} className="flex flex-col rounded-2xl border border-teal-200 bg-teal-50/70 p-5 text-slate-900"><span className="mb-3 flex items-center gap-2 text-xs font-medium text-teal-800"><ClipboardList className="h-4 w-4" />{t.source} · Connected task</span><h2 className="break-words text-lg font-semibold">{t.title}</h2><p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-600">{t.body}</p><p className="mt-4 text-xs">{t.due_date ? dayLabel(t.due_date) : 'Date not set'} · {t.completed ? 'Completed' : 'Pending'}</p><Button asChild variant="outline" className="mt-4 w-fit bg-white"><Link to={t.href}>ജോലി തുറക്കുക<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button><p className="mt-2 text-[11px] text-slate-500">Updates and photos stay with the original task.</p></article>)}</div>}
    {!isPending && !isError && !filteredNotes.length && !filteredTasks.length && <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-700"><Sparkles className="mx-auto mb-3 h-9 w-9 text-teal-600" /><p className="font-semibold">ഈ വിഭാഗത്തിൽ കാര്യങ്ങളൊന്നുമില്ല</p><p className="mt-2 text-sm">മറ്റൊരു തീയതി തിരഞ്ഞെടുക്കുക, അല്ലെങ്കിൽ പുതിയ കുറിപ്പ് ചേർക്കുക.</p></div>}
    {isAdmin && <details className="rounded-xl border bg-white p-4 text-slate-700"><summary className="cursor-pointer text-sm font-medium">Integrations · Future connections</summary><p className="mt-3 text-xs leading-relaxed">WhatsApp: OFF · External automation: OFF. Dashboard reminders are active. No messages are sent. Provider setup, staff consent and a secure scheduled sender must be configured before activation.</p></details>}
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="diary-dialog max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogTitle>{editing ? 'കുറിപ്പ് / Diary note' : 'പുതിയ കുറിപ്പ് / New note'}</DialogTitle><DialogDescription>{draft.kind === 'personal' ? 'Private to your login. Add an optional date, reminder and photos.' : 'Assigned instruction. Read status and completion are tracked separately.'}</DialogDescription>
      <form onSubmit={save} className="space-y-4">
        {isAdmin && !editing && <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="diary-kind">Note type</Label><select id="diary-kind" className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as DiaryNote['kind'] })}><option value="personal">Private note</option><option value="assignment">Assign to staff</option></select></div>{draft.kind === 'assignment' && <div><Label htmlFor="diary-owner">Staff member</Label><select id="diary-owner" className="mt-1 h-10 w-full rounded-md border bg-background px-3" required value={draft.owner_id} onChange={e => setDraft({ ...draft, owner_id: e.target.value })}><option value="">Choose staff</option>{roster.data?.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name || p.email}</option>)}</select>{roster.isError && <button type="button" className="text-xs underline" onClick={() => roster.refetch()}>Could not load staff. Retry</button>}</div>}</div>}
        <div><Label htmlFor="diary-title">എന്താണ് ചെയ്യേണ്ടത്?</Label><Input id="diary-title" value={draft.title} maxLength={200} required disabled={!writable || busy} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
        <div><Label htmlFor="diary-body">വിശദീകരണം</Label><Textarea id="diary-body" rows={4} maxLength={10000} value={draft.body} disabled={!writable || busy} onChange={e => setDraft({ ...draft, body: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="diary-date">ചെയ്യേണ്ട തീയതി (optional)</Label><Input id="diary-date" type="date" value={draft.due_date} disabled={!writable || busy} onChange={e => setDraft({ ...draft, due_date: e.target.value })} /></div><div><Label htmlFor="diary-reminder">Reminder · Indian time (optional)</Label><Input id="diary-reminder" type="datetime-local" value={draft.reminder} disabled={!writable || busy} onChange={e => setDraft({ ...draft, reminder: e.target.value })} /></div></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.priority === 'important'} disabled={!writable || busy} onChange={e => setDraft({ ...draft, priority: e.target.checked ? 'important' : 'normal' })} />പ്രധാനപ്പെട്ടത് / Important</label>
        {writable && <Button type="submit" disabled={busy} className="w-full bg-teal-800 text-white hover:bg-teal-700">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{editing ? 'Save changes' : 'Save note · തുടർന്ന് ചിത്രങ്ങൾ ചേർക്കാം'}</Button>}
      </form>
      {editing ? <DiaryImages key={editing.id} noteId={editing.id} /> : <p className="flex items-center gap-2 text-xs text-muted-foreground"><ImagePlus className="h-4 w-4" />Save the note first to securely attach photos.</p>}
    </DialogContent></Dialog>
  </div>;
  return isWorker && !isOfficeStaff ? <div className="min-h-screen bg-[#fbf8f2] p-4"><div className="mx-auto max-w-5xl"><Button asChild variant="outline" className="mb-4"><Link to="/worker">← My work</Link></Button>{content}</div></div> : <AdminShell>{content}</AdminShell>;
}
