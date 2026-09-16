export type DiaryNote = {
  id: string; owner_id: string; created_by: string; kind: 'personal' | 'assignment';
  title: string; body: string; due_date: string | null; reminder_at: string | null;
  priority: 'normal' | 'important'; pinned: boolean; status: 'pending' | 'completed';
  read_at: string | null; completed_at: string | null; created_at: string; updated_at: string;
  deleted_at: string | null; revision: number;
};
export type DiaryTask = {
  id: string; source: string; title: string; body: string | null;
  due_date: string | null; completed: boolean; href: string;
};
export type DiaryTab = 'today' | 'upcoming' | 'overdue' | 'all' | 'completed';
export const diaryToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);
export function diaryMatches(due: string | null, completed: boolean, tab: DiaryTab, today: string) {
  if (tab === 'completed') return completed;
  if (completed) return false;
  if (tab === 'today') return due === today;
  if (tab === 'overdue') return !!due && due < today;
  if (tab === 'upcoming') return !!due && due > today;
  return true;
}
export function reminderDue(note: DiaryNote, now = new Date()) {
  return !note.deleted_at && note.status === 'pending' && !!note.reminder_at && new Date(note.reminder_at) <= now;
}
export function reminderInput(value: string | null) {
  if (!value) return '';
  // datetime-local always represents the showroom's Indian time, independent of device timezone.
  return new Date(new Date(value).getTime() + 330 * 60_000).toISOString().slice(0, 16);
}
export function reminderISO(value: string) {
  return value ? new Date(`${value}:00+05:30`).toISOString() : null;
}
export const diaryTabs: { id: DiaryTab; label: string }[] = [
  { id: 'today', label: 'ഇന്ന്' }, { id: 'overdue', label: 'ബാക്കിയുള്ളത്' },
  { id: 'upcoming', label: 'വരാനിരിക്കുന്നത്' }, { id: 'all', label: 'എല്ലാ കുറിപ്പുകളും' },
  { id: 'completed', label: 'പൂർത്തിയായത്' },
];
