import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Phase1Api } from '../lib/phase1-api';
import type { AttendanceRanking } from '../lib/attendance-ranking';
import { FootballLoader } from './FootballLoader';

export function AttendanceRankingPage({ api, memberId }: { api: Phase1Api; memberId: string }) {
  return <RankingContent key={memberId} api={api} />;
}

function RankingContent({ api }: { api: Phase1Api }) {
  const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Copenhagen', year: 'numeric' }).format(new Date()));
  const [year, setYear] = useState<number | null>(currentYear);
  const [data, setData] = useState<AttendanceRanking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setError(null);
    void api.getAttendanceRanking(year).then((result) => {
      if (active) setData(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load attendance ranking.');
    });
    return () => { active = false; };
  }, [api, year, attempt]);
  const years = [...new Set([currentYear, ...(data?.years ?? []), ...(year === null ? [] : [year])])].sort((a, b) => b - a);
  return <section className="space-y-5">
    <Link to="/" className="inline-flex min-h-11 items-center font-bold text-footballBlue">Back to Home</Link>
    <div className="border-b border-navy/10 pb-4">
      <h2 className="text-xl font-bold text-navy">Attendance Top 10</h2>
      <p className="mt-2 text-sm text-navy/70">Going RSVPs · Past and today's events</p>
    </div>
    <label className="block text-sm font-bold text-navy">Period
      <select value={year ?? 'all'} onChange={(event) => setYear(event.target.value === 'all' ? null : Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-md border border-navy/20 bg-white px-3 text-base">
        {years.map((value) => <option key={value} value={value}>{value}</option>)}
        <option value="all">All time</option>
      </select>
    </label>
    {!data && !error ? <div role="status" aria-label="Loading attendance ranking"><FootballLoader /></div> : null}
    {error ? <div><p role="alert" className="text-sm font-semibold text-red-800">{error}</p><button type="button" className="mt-3 min-h-12 rounded-md border border-navy/20 bg-white px-4 font-bold text-navy" onClick={() => setAttempt((value) => value + 1)}>Retry ranking</button></div> : null}
    {data && !data.rankings.length ? <p className="py-6 text-sm text-navy/70">No Going RSVPs in this period.</p> : null}
    {data && data.rankings.length ? <table className="w-full table-fixed text-left text-sm">
      <caption className="sr-only">Top 10 members by Going RSVPs</caption>
      <thead className="border-b border-navy/20 text-navy/65"><tr><th scope="col" className="w-12 pb-3">Rank</th><th scope="col" className="pb-3">Member</th><th scope="col" className="w-16 pb-3 text-right">Events</th></tr></thead>
      <tbody className="divide-y divide-navy/10">{data.rankings.map((row) => <tr key={row.memberId}>
        <td className="py-4 font-bold tabular-nums text-footballBlue">{row.rank}</td>
        <th scope="row" className="break-words py-4 pr-3 font-semibold text-navy">{row.first_name}{row.membership_status === 'Inactive' ? <span className="mt-1 block text-xs font-normal text-navy/65">Inactive</span> : null}</th>
        <td className="py-4 text-right font-bold tabular-nums text-navy">{row.attended}</td>
      </tr>)}</tbody>
    </table> : null}
  </section>;
}
