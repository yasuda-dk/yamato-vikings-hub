import { useEffect, useState } from 'react';
import type { Phase1Api } from '../lib/phase1-api';
import type { PracticePaymentState, UnpaidPractice } from '../lib/practice-payments';
import { FootballLoader } from './FootballLoader';

export function MyUnpaidPractices({ api, refreshKey, onRecorded }: { api: Phase1Api; refreshKey: string; onRecorded: (state: PracticePaymentState) => void }) {
  const [rows, setRows] = useState<UnpaidPractice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void api.getMyUnpaidPractices().then((result) => { if (active) setRows(result); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load unpaid Practices.');
    });
    return () => { active = false; };
  }, [api, refreshKey, attempt]);

  async function markPaid(row: UnpaidPractice) {
    if (busyId) return;
    setBusyId(row.id); setError(null); setSuccess(null);
    try {
      const state = await api.markPracticePaymentPaid(row.id);
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? []);
      setSuccess(`${practiceDate(row)} marked as paid.`);
      onRecorded(state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not mark payment paid.');
    } finally { setBusyId(null); }
  }

  return <section className="border-t border-navy/15 px-4 py-5" aria-labelledby="my-unpaid-title">
    <h2 id="my-unpaid-title" className="text-xl font-bold text-navy">Your unpaid Practices</h2>
    {rows ? <p className="mt-2 text-sm font-semibold text-navy/70">{rows.length} unpaid · {rows.reduce((sum, row) => sum + row.amount_dkk, 0)} kr total</p> : null}
    {!rows && !error ? <div className="mt-4" role="status" aria-label="Loading your unpaid Practices"><FootballLoader /></div> : null}
    {success ? <p role="status" className="mt-4 text-sm font-semibold text-footballBlue">{success}</p> : null}
    {error ? <div className="mt-4"><p role="alert" className="text-sm font-semibold text-red-800">{error}</p><button type="button" disabled={Boolean(busyId)} onClick={() => setAttempt((value) => value + 1)} className="mt-3 min-h-12 rounded-md border border-navy/20 bg-white px-4 font-bold text-navy">Retry unpaid Practices</button></div> : null}
    {rows?.length === 0 ? <p className="mt-4 text-sm text-navy/70">No unpaid past Practices.</p> : null}
    <ul className="mt-3 divide-y divide-navy/10">{rows?.map((row) => <li key={row.id} className="py-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold text-navy">{practiceDate(row)}</h3><p className="mt-1 break-words text-sm text-navy/70">{row.title} · {row.location}</p></div><span className="shrink-0 font-bold tabular-nums text-navy">{row.amount_dkk} kr</span></div>
      <button type="button" aria-label={`Mark ${practiceDate(row)} as paid`} disabled={Boolean(busyId)} onClick={() => void markPaid(row)} className="mt-3 min-h-12 w-full rounded-md bg-footballBlue px-4 font-bold text-white disabled:bg-navy/40">{busyId === row.id ? 'Saving...' : 'Mark as paid'}</button>
    </li>)}</ul>
  </section>;
}

function practiceDate(row: UnpaidPractice) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${row.event_date}T12:00:00`));
}
