import { describe, expect, it } from 'vitest';
import { diaryMatches, diaryToday, reminderDue, reminderInput, reminderISO, type DiaryNote } from './diary';
describe('diary dates and reminders', () => {
  it('switches day at Indian midnight, not UTC midnight', () => {
    expect(diaryToday(new Date('2026-09-19T18:29:59Z'))).toBe('2026-09-19');
    expect(diaryToday(new Date('2026-09-19T18:30:00Z'))).toBe('2026-09-20');
  });
  it('round trips showroom reminder time independently of the device timezone', () => {
    expect(reminderISO('2026-09-20T10:00')).toBe('2026-09-20T04:30:00.000Z');
    expect(reminderInput('2026-09-20T04:30:00Z')).toBe('2026-09-20T10:00');
    expect(reminderISO('')).toBeNull();
  });
  it('preserves undated notes and keeps completed entries out of pending lists', () => {
    expect(diaryMatches(null, false, 'all', '2026-09-20')).toBe(true);
    expect(diaryMatches(null, false, 'today', '2026-09-20')).toBe(false);
    expect(diaryMatches('2026-09-19', false, 'overdue', '2026-09-20')).toBe(true);
    expect(diaryMatches('2026-09-19', true, 'overdue', '2026-09-20')).toBe(false);
    expect(diaryMatches('2026-09-19', true, 'completed', '2026-09-20')).toBe(true);
  });
  it('retains missed reminders but cancels completed and removed notes', () => {
    const n = { status: 'pending', reminder_at: '2026-09-20T04:30:00Z', deleted_at: null } as DiaryNote;
    expect(reminderDue(n, new Date('2026-09-20T04:29:00Z'))).toBe(false);
    expect(reminderDue(n, new Date('2026-09-23T04:30:00Z'))).toBe(true);
    expect(reminderDue({ ...n, status: 'completed' }, new Date('2026-09-23T04:30:00Z'))).toBe(false);
    expect(reminderDue({ ...n, deleted_at: '2026-09-21T00:00:00Z' }, new Date('2026-09-23T04:30:00Z'))).toBe(false);
  });
});
