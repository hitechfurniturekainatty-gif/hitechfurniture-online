import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight, Bell } from 'lucide-react';
import { useDiary } from '@/hooks/useDiary';
import { useAuth } from '@/hooks/useAuth';
import { reminderDue, reminderInput } from '@/lib/diary';

export function DiaryReminderCard() {
  const { user } = useAuth();
  const { notes, tasks, today, now, isError, refetch } = useDiary();
  const mine = notes.filter(n => n.owner_id === user?.id && n.status === 'pending');
  const active = [...mine.map(n => ({ due_date: n.due_date || (n.reminder_at ? reminderInput(n.reminder_at).slice(0, 10) : null) })), ...tasks.filter(t => !t.completed)];
  const due = active.filter(n => n.due_date === today).length;
  const overdue = active.filter(n => n.due_date && n.due_date < today).length;
  const unread = mine.filter(n => n.kind === 'assignment' && !n.read_at).length;
  const reminders = mine.filter(n => reminderDue(n, now)).length;
  return <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-amber-50 p-4 text-teal-950" aria-label="Diary reminders">
    <Link to="/admin/diary" className="flex min-w-0 items-center gap-3">
      <span className="rounded-xl bg-teal-700 p-3 text-white"><BookOpen className="h-5 w-5" /></span>
      <div><p className="font-semibold">My Diary <span className="text-xs font-normal">· എന്റെ ഡയറി</span></p>
        {isError ? <p className="text-xs">Reminders could not load</p> : <p className="mt-1 text-xs">ഇന്ന് {due} · ബാക്കി {overdue} · പുതിയ നിർദേശങ്ങൾ {unread}{reminders > 0 && ` · ഓർമ്മപ്പെടുത്തലുകൾ ${reminders}`}</p>}
      </div>
    </Link>
    {isError ? <button className="text-sm underline" onClick={() => refetch()}>Retry</button> : <Link to="/admin/diary" aria-label="Open my diary" className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">{(unread > 0 || reminders > 0) && <Bell className="h-4 w-4 text-amber-700" />}Open <ArrowRight className="h-4 w-4" /></Link>}
  </section>;
}
