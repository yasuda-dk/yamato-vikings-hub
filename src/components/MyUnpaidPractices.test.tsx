import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MyUnpaidPractices } from './MyUnpaidPractices';
import type { Phase1Api } from '../lib/phase1-api';
import type { PracticePaymentState, UnpaidPractice } from '../lib/practice-payments';

const rows: UnpaidPractice[] = [
  { id: 'old', title: 'Practice', event_date: '2024-09-10', start_time: '18:00', location: 'Indoor pitch', payment_deadline_date: '2024-09-11', amount_dkk: 80 },
  { id: 'recent', title: 'Practice 4 vs 4', event_date: '2026-11-10', start_time: '18:00', location: 'Pitch B', payment_deadline_date: '2026-11-11', amount_dkk: 80 },
];
function setup() {
  const getMyUnpaidPractices = vi.fn().mockResolvedValue(rows);
  const markPracticePaymentPaid = vi.fn().mockResolvedValue({} as PracticePaymentState);
  const api = { getMyUnpaidPractices, markPracticePaymentPaid } as unknown as Phase1Api;
  const onRecorded = vi.fn();
  render(<MyUnpaidPractices api={api} refreshKey="test" onRecorded={onRecorded} />);
  return { api, getMyUnpaidPractices, markPracticePaymentPaid, onRecorded };
}
describe('personal unpaid Practices', () => {
  it('shows all historical dates and totals, saves only the clicked event, and removes it', async () => {
    const state = setup();
    expect(screen.getByRole('status', { name: 'Loading your unpaid Practices' })).toBeInTheDocument();
    expect(await screen.findByText('2 unpaid · 160 kr total')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mark 10 Sept 2024 as paid' }));
    expect(await screen.findByText('10 Sept 2024 marked as paid.')).toBeInTheDocument();
    expect(state.markPracticePaymentPaid).toHaveBeenCalledWith('old');
    expect(state.onRecorded).toHaveBeenCalledOnce();
    expect(screen.getByText('1 unpaid · 80 kr total')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark 10 Sept 2024 as paid' })).not.toBeInTheDocument();
  });
  it('keeps unpaid rows after errors and disables all pay buttons during a save', async () => {
    const state = setup();
    await screen.findByText('2 unpaid · 160 kr total');
    let reject: (reason: Error) => void = () => {};
    state.markPracticePaymentPaid.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mark 10 Sept 2024 as paid' }));
    expect(screen.getByRole('button', { name: 'Mark 10 Nov 2026 as paid' })).toBeDisabled();
    reject(new Error('Connection lost'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark 10 Sept 2024 as paid' })).toBeEnabled());
    expect(screen.getByText('2 unpaid · 160 kr total')).toBeInTheDocument();
  });
  it('can retry a load failure and shows the empty state', async () => {
    const api = { getMyUnpaidPractices: vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([]) } as unknown as Phase1Api;
    render(<MyUnpaidPractices api={api} refreshKey="test" onRecorded={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry unpaid Practices' }));
    expect(await screen.findByText('No unpaid past Practices.')).toBeInTheDocument();
  });
});
