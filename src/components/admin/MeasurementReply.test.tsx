import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeasurementReply } from './MeasurementReply';
const mocks = vi.hoisted(() => ({ load: vi.fn(), rpc: vi.fn(), upload: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
 from: () => ({ select: () => ({ eq: () => ({ in: mocks.load }) }) }), rpc: mocks.rpc,
 storage: { from: () => ({ upload: mocks.upload, getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/photo.jpg' } }) }) },
} }));
vi.mock('@/lib/imageCompression', () => ({ compressImage: async (file: File) => file }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
const task = { id: 'task1', item_ids: ['one'], draft_quotation_id: 'quote1', status: 'pending' };
const row = (description: string) => ({ id: 'one', description, measurement: '60 x 30', measurement_image_url: null, item_image_url: null });
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); mocks.upload.mockResolvedValue({ error: null }); });
describe('Measurement reply recovery', () => {
 it('retries a failed load and blocks completion until all items load', async () => {
  mocks.load.mockResolvedValueOnce({ data: null, error: { message: 'Offline' } }).mockResolvedValueOnce({ data: [row('Sofa')], error: null });
  render(<MeasurementReply task={task} onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(await screen.findByText('Offline')).toBeInTheDocument();
  expect(screen.getByText('Complete & send to office')).toBeDisabled();
  fireEvent.click(screen.getByText('Retry loading'));
  expect(await screen.findByText('Sofa')).toBeInTheDocument();
  expect(screen.getByText('Complete & send to office')).toBeEnabled();
 });
 it('ignores an earlier task response arriving after another task opens', async () => {
  let resolveOld: (value: unknown) => void = () => {};
  mocks.load.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ data: [row('Current task')], error: null });
  const view = render(<MeasurementReply task={task} onClose={vi.fn()} onSaved={vi.fn()} />);
  view.rerender(<MeasurementReply task={{ ...task, id: 'task2' }} onClose={vi.fn()} onSaved={vi.fn()} />);
  await screen.findByText('Current task');
  await act(async () => resolveOld({ data: [row('Old task')], error: null }));
  expect(screen.queryByText('Old task')).not.toBeInTheDocument();
 });
 it('reuses an uploaded photo when completion fails and is retried', async () => {
  mocks.load.mockResolvedValue({ data: [row('Sofa')], error: null });
  mocks.rpc.mockResolvedValueOnce({ error: { message: 'Save failed' } }).mockResolvedValueOnce({ error: null });
  const saved = vi.fn();
  render(<MeasurementReply task={task} onClose={vi.fn()} onSaved={saved} />);
  await screen.findByText('Sofa');
  fireEvent.change(screen.getByLabelText('Photo / sketch (optional)'), { target: { files: [new File(['photo'], 'test.jpg', { type: 'image/jpeg' })] } });
  fireEvent.click(screen.getByText('Complete & send to office'));
  await screen.findByText('Save failed');
  fireEvent.click(screen.getByText('Complete & send to office'));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
 });
});
