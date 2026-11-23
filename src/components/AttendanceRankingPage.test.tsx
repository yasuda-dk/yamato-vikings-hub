import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Phase1Api } from '../lib/phase1-api';
import { AttendanceRankingPage } from './AttendanceRankingPage';

function show(getAttendanceRanking = vi.fn().mockResolvedValue({ years: [2026, 2025], rankings: [] })) {
  const api = { getAttendanceRanking } as unknown as Phase1Api;
  const view = render(<MemoryRouter><AttendanceRankingPage api={api} memberId="takashi" /></MemoryRouter>);
  return { ...view, api, getAttendanceRanking };
}
describe('attendance ranking', () => {
  it('shows the empty state and requests all time separately', async () => {
    const { getAttendanceRanking } = show();
    expect(await screen.findByText('No Going RSVPs in this period.')).toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByLabelText('Period'), 'all');
    expect(getAttendanceRanking).toHaveBeenLastCalledWith(null);
  });
  it('shows counts, tied ranks and former members', async () => {
    show(vi.fn().mockResolvedValue({ years: [2026], rankings: [
      { memberId: 'a', first_name: 'Former', membership_status: 'Inactive', rank: 1, attended: 8 },
      { memberId: 'b', first_name: 'Current', membership_status: 'Active', rank: 1, attended: 8 },
    ] }));
    expect(await screen.findByRole('rowheader', { name: 'Former Inactive' })).toBeInTheDocument();
    expect(screen.getAllByRole('cell', { name: '8' })).toHaveLength(2);
    expect(screen.getAllByRole('cell', { name: '1' })).toHaveLength(2);
  });
  it('shows loading, retries errors and never renders unauthorized results', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('Only Takashi can view attendance rankings')).mockResolvedValue({ years: [], rankings: [] });
    show(get);
    expect(screen.getByRole('status', { name: 'Loading attendance ranking' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Only Takashi');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry ranking' }));
    expect(await screen.findByText('No Going RSVPs in this period.')).toBeInTheDocument();
  });
  it('erases private data immediately when switching profile', async () => {
    const get = vi.fn().mockResolvedValue({ years: [], rankings: [{ memberId: 'a', first_name: 'Private', membership_status: 'Active', rank: 1, attended: 8 }] });
    const view = show(get);
    await screen.findByText('Private');
    get.mockImplementation(() => new Promise(() => {}));
    view.rerender(<MemoryRouter><AttendanceRankingPage api={view.api} memberId="other" /></MemoryRouter>);
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
  });
});
