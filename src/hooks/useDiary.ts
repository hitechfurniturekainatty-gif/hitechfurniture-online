import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DiaryNote, DiaryTask, diaryToday } from '@/lib/diary';

// New schema is maintained by the diary migration; keep the existing generated schema untouched.
type DiaryTable<Row, Insert = Partial<Row>> = { Row: Row; Insert: Insert; Update: Partial<Row>; Relationships: [] };
type DiaryImage = { id: string; note_id: string; storage_path: string; caption: string; created_by: string; created_at: string };
type DiaryDatabase = Database & { public: { Tables: {
  staff_diary_notes: DiaryTable<DiaryNote>;
  staff_diary_images: DiaryTable<DiaryImage>;
}; Views: { staff_diary_tasks: { Row: DiaryTask; Relationships: [] } } } };
export const diaryDb = supabase as unknown as SupabaseClient<DiaryDatabase>;

async function allRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await fetchPage(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export function useDiary() {
  const { user, isStaff } = useAuth();
  const client = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const query = useQuery({
    queryKey: ['diary', user?.id], enabled: !!user && isStaff,
    refetchOnWindowFocus: true, refetchInterval: 60_000,
    queryFn: async () => {
      const [notes, tasks] = await Promise.all([
        allRows<DiaryNote>((from, to) => diaryDb.from('staff_diary_notes').select('*').is('deleted_at', null).order('created_at', { ascending: false }).order('id').range(from, to)),
        allRows<DiaryTask>((from, to) => diaryDb.from('staff_diary_tasks').select('*').order('source').order('id').range(from, to)),
      ]);
      return { notes, tasks };
    },
  });
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: ['diary'] }), [client]);
  return { ...query, notes: query.data?.notes ?? [], tasks: query.data?.tasks ?? [], now,
    today: diaryToday(now), refresh };
}
