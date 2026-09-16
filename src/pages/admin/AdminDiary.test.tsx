import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DiaryNote } from '@/lib/diary';
const mock = vi.hoisted(() => ({ notes: [] as DiaryNote[], patch: vi.fn(), refresh: vi.fn(), error: vi.fn(), failed: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'staff', email: 'staff@test.invalid' }, isStaff: true, loading: false, isAdmin: false, isWorker: false }) }));
vi.mock('@/components/admin/AdminShell', () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/admin/DiaryImages', () => ({ DiaryImages: () => <div>Private image controls</div> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mock.error } }));
vi.mock('@/hooks/useDiary', () => ({
  useDiary: () => ({ notes: mock.notes, tasks: [], today: '2026-09-20', now: new Date('2026-09-20T06:00:00Z'), refresh: mock.refresh, isPending: false, isError: mock.failed, refetch: mock.refresh }),
  diaryDb: { from: () => ({ update: (patch: Partial<DiaryNote>) => { mock.patch(patch); const chain = { eq: () => chain, select: () => chain, maybeSingle: async () => ({ data: { ...mock.notes[0], ...patch }, error: null }) }; return chain; } }) },
}));
import AdminDiary from './AdminDiary';
const note = (override: Partial<DiaryNote> = {}): DiaryNote => ({ id: 'note', owner_id: 'staff', created_by: 'staff', kind: 'personal', title: 'Confirm sofa fabric', body: 'Call the customer', due_date: '2026-09-20', reminder_at: null, priority: 'normal', pinned: false, status: 'pending', read_at: null, completed_at: null, created_at: '2026-09-19T00:00:00Z', updated_at: '2026-09-19T00:00:00Z', deleted_at: null, revision: 1, ...override });
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><AdminDiary /></MemoryRouter></QueryClientProvider>); }
beforeEach(() => { mock.notes = [note()]; mock.failed = false; mock.patch.mockReset(); mock.refresh.mockReset(); mock.error.mockReset(); });
describe('staff diary workflow', () => {
  it('retains undated notes under all notes and overdue notes under overdue', () => {
    mock.notes.push(note({ id: 'old', title: 'Old task', due_date: '2026-09-19' }), note({ id: 'undated', title: 'My idea', due_date: null }));
    mount();
    expect(screen.getByRole('heading', { name: 'Confirm sofa fabric' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My idea' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'ബാക്കിയുള്ളത്' }));
    expect(screen.getByRole('heading', { name: 'Old task' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'എല്ലാ കുറിപ്പുകളും' }));
    expect(screen.getByRole('heading', { name: 'My idea' })).toBeInTheDocument();
  });
  it('completes through the database and refreshes without deleting the note', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'പൂർത്തിയായി', exact: true }));
    await waitFor(() => expect(mock.patch).toHaveBeenCalledWith({ status: 'completed' }));
    await waitFor(() => expect(mock.refresh).toHaveBeenCalled());
  });
  it('shows a due reminder today even when the task due date is later', () => {
    mock.notes = [note({ due_date: '2026-09-25', reminder_at: '2026-09-20T04:30:00Z' })];
    mount(); expect(screen.getByRole('heading', { name: 'Confirm sofa fabric' })).toBeInTheDocument();
    expect(screen.getByText('Reminder')).toBeInTheDocument();
  });
  it('marks an assigned instruction read but does not allow staff to edit its text', async () => {
    mock.notes = [note({ kind: 'assignment', created_by: 'admin' })]; mount();
    fireEvent.click(screen.getByRole('button', { name: 'Open', exact: true }));
    await waitFor(() => expect(mock.patch).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) })));
    expect(screen.getByLabelText('എന്താണ് ചെയ്യേണ്ടത്?')).toBeDisabled();
    expect(screen.getByText('Private image controls')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
  it('shows retry rather than an empty success state on load failure', () => {
    mock.failed = true; mount();
    expect(screen.getByRole('alert')).toHaveTextContent('could not load');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mock.refresh).toHaveBeenCalled();
  });
});
