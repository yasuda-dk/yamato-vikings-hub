import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ createSupabaseBrowserClient: () => ({ functions: { invoke } }) }));
import { phase1Api } from './phase1-api';

describe('progressive practice payment API', () => {
  beforeEach(() => invoke.mockReset());

  it('requests only current payment data and keeps tracking permission without an event', async () => {
    invoke.mockResolvedValue({ data: { ok: true, practicePayment: { event: null, canTrackPayments: true } }, error: null });
    const state = await phase1Api.getPracticePayment();
    expect(invoke).toHaveBeenCalledWith('practice-payment-state', { body: expect.objectContaining({ section: 'current' }) });
    expect(state.canTrackPayments).toBe(true);
    expect(state.practiceHistory).toEqual([]);
  });

  it('requests history separately and handles empty history', async () => {
    invoke.mockResolvedValue({ data: { ok: true, practiceHistory: [] }, error: null });
    expect(await phase1Api.getPracticePaymentHistory()).toEqual([]);
    expect(invoke).toHaveBeenCalledWith('practice-payment-state', { body: expect.objectContaining({ section: 'history' }) });
  });

  it('propagates history errors without replacing current data', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: 'History unavailable' }, error: null });
    await expect(phase1Api.getPracticePaymentHistory()).rejects.toThrow('History unavailable');
  });
});
