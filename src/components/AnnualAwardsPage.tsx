import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { MemberProfile } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';
import { awardDeadlineInput, awardLabels, awardTypes, formatAwardDeadline, type AnnualAwardsResults, type AnnualAwardsState, type AwardCandidate, type AwardSurvey, type AwardType, type AwardVote } from '../lib/annual-awards';
import { LoadingScreen } from './LoadingScreen';

const inputClass = 'mt-2 min-h-12 w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-base text-navy focus:outline-none focus:ring-2 focus:ring-footballBlue';
const buttonClass = 'min-h-12 rounded-md bg-footballBlue px-4 py-3 text-base font-bold text-white disabled:bg-navy/40';

export function AnnualAwardsPage({ api, selectedMember }: { api: Phase1Api; selectedMember: MemberProfile }) {
  return <AwardsContent key={selectedMember.id} api={api} />;
}

function AwardsContent({ api }: { api: Phase1Api }) {
  const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Copenhagen', year: 'numeric' }).format(new Date()));
  const [year, setYear] = useState(currentYear);
  const [state, setState] = useState<AnnualAwardsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<'vote' | 'results'>('vote');
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let mounted = true;
    setState(null);
    setError(null);
    setView('vote');
    void api.getAnnualAwards(year).then((next) => { if (mounted) setState(next); }).catch((reason: unknown) => {
      if (mounted) setError(reason instanceof Error ? reason.message : 'Could not load annual awards.');
    });
    return () => { mounted = false; };
  }, [api, year, attempt]);

  const deadline = state?.survey?.deadline;
  useEffect(() => {
    if (!deadline) return;
    const remaining = new Date(deadline).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining + 20, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [deadline, now]);

  const survey = state?.survey;
  const canVote = Boolean(survey?.canVote && new Date(survey.deadline).getTime() > Math.max(now, Date.now()));
  const years = [...new Set([currentYear, year, ...(state?.years ?? []), ...(state?.canManage ? [currentYear + 1] : [])])].sort((a, b) => b - a);

  async function saveVote(vote: AwardVote) {
    if (!survey) return;
    const surveyId = survey.id;
    await api.saveAnnualAwardVote(surveyId, vote);
    setState((current) => current?.survey?.id === surveyId ? { ...current, ownVotes: [...current.ownVotes.filter((saved) => saved.award !== vote.award), vote] } : current);
  }

  return (
    <section className="space-y-4">
      <Link to="/" className="inline-flex min-h-11 items-center font-bold text-footballBlue">Back to Home</Link>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-navy">Annual Awards</h2>
        <label className="w-24 shrink-0 text-sm font-semibold">Year
          <select aria-label="Award year" className={inputClass} value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm leading-5 text-navy/70">Votes and comments are private to Takashi.</p>
      {error ? <div role="alert" className="space-y-3 border-t border-navy/10 pt-4"><p className="text-sm font-semibold text-red-800">{error}</p><button type="button" className={buttonClass} onClick={() => setAttempt((value) => value + 1)}>Retry awards</button></div> : null}
      {!state && !error ? <LoadingScreen title="Opening annual awards" /> : null}
      {state ? <>
        {state.canManage ? <div role="tablist" aria-label="Annual awards views" className="grid grid-cols-2 border-b border-navy/20">
          {(['vote', 'results'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={view === tab} className={`min-h-12 border-b-2 text-base font-bold ${view === tab ? 'border-footballBlue text-footballBlue' : 'border-transparent text-navy/70'}`} onClick={() => setView(tab)}>{tab === 'vote' ? 'Your votes' : 'Results'}</button>)}
        </div> : null}
        {survey ? <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/10 pb-4 text-sm">
          <span className="font-bold">{survey.status === 'Open' && new Date(survey.deadline).getTime() > Math.max(now, Date.now()) ? 'Voting open' : 'Voting closed'}</span>
          <span>Deadline: {formatAwardDeadline(survey.deadline)} Copenhagen</span>
        </div> : <p className="border-t border-navy/10 py-4 text-sm text-navy/70">Annual voting is not open for {year}.</p>}
        {view === 'vote' && survey ? awardTypes.map((award) => <AwardBallot key={`${survey.id}:${award}`} award={award} candidates={state.candidates} saved={state.ownVotes.find((vote) => vote.award === award)} canVote={canVote} onSave={saveVote} />) : null}
        {view === 'results' && state.canManage && survey ? <AwardResults key={survey.id} api={api} surveyId={survey.id} /> : null}
        {state.canManage ? <SurveySettings key={`${year}:${survey?.deadline ?? 'new'}:${survey?.status ?? ''}`} api={api} year={year} survey={survey ?? null} onSaved={() => setAttempt((value) => value + 1)} /> : null}
      </> : null}
    </section>
  );
}

function AwardBallot({ award, candidates, saved, canVote, onSave }: { award: AwardType; candidates: AwardCandidate[]; saved?: AwardVote; canVote: boolean; onSave: (vote: AwardVote) => Promise<void> }) {
  const [candidateId, setCandidateId] = useState(saved?.candidateId ?? '');
  const [comment, setComment] = useState(saved?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canVote || busy) return;
    setBusy(true); setError(null); setSuccess(false);
    try { await onSave({ award, candidateId, comment: comment.trim() }); setSuccess(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your vote.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(event) => void submit(event)} className="border-b border-navy/10 pb-5">
    <fieldset disabled={!canVote || busy}>
      <legend className="text-xl font-bold">{award} <span className="block text-base font-semibold text-navy/70">{awardLabels[award].title}</span></legend>
      <p className="mt-2 text-sm leading-5 text-navy/70">{awardLabels[award].description}</p>
      <label className="mt-4 block text-sm font-semibold">{award} nominee
        <select className={inputClass} required value={candidateId} onChange={(event) => { setCandidateId(event.target.value); setSuccess(false); }}>
          <option value="">Choose a member</option>
          {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.first_name}{candidate.membership_status !== 'Active' ? ' (Inactive)' : ''}</option>)}
        </select>
      </label>
      <label className="mt-4 block text-sm font-semibold">{award} comment
        <textarea className={`${inputClass} min-h-24 resize-y`} required maxLength={1000} value={comment} onChange={(event) => { setComment(event.target.value); setSuccess(false); }} />
      </label>
      <div className="mt-1 text-right text-xs text-navy/70">{comment.length}/1000</div>
      <button type="submit" disabled={!canVote || busy || !candidateId || !comment.trim()} className={`${buttonClass} mt-3 w-full`}>{busy ? 'Saving...' : saved ? `Update ${award} vote` : `Submit ${award} vote`}</button>
    </fieldset>
    {saved && !success ? <p className="mt-2 text-sm font-semibold text-footballBlue">Your {award} vote is saved.</p> : null}
    {success ? <p role="status" className="mt-2 text-sm font-semibold text-footballBlue">{award} vote saved.</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p> : null}
  </form>;
}

function SurveySettings({ api, year, survey, onSaved }: { api: Phase1Api; year: number; survey: AwardSurvey | null; onSaved: () => void }) {
  const [deadlineLocal, setDeadlineLocal] = useState(survey ? awardDeadlineInput(survey.deadline) : `${year}-${year === 2026 ? '11-28' : '12-01'}T18:00`);
  const [status, setStatus] = useState<'Open' | 'Closed'>(survey?.status ?? 'Open');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await api.manageAnnualAwards({ year, deadlineLocal, status }); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save voting settings.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(event) => void save(event)} className="border-t border-navy/10 pt-4">
    <h3 className="text-lg font-bold">Voting settings</h3>
    <fieldset disabled={busy}>
      <label className="mt-3 block text-sm font-semibold">Deadline (Copenhagen)<input type="datetime-local" required value={deadlineLocal} onChange={(event) => setDeadlineLocal(event.target.value)} className={inputClass} /></label>
      <label className="mt-3 block text-sm font-semibold">Voting status<select value={status} onChange={(event) => setStatus(event.target.value as 'Open' | 'Closed')} className={inputClass}><option>Open</option><option>Closed</option></select></label>
      <button type="submit" className={`${buttonClass} mt-4 w-full`} disabled={busy}>{busy ? 'Saving...' : survey ? 'Save voting settings' : 'Open annual voting'}</button>
    </fieldset>
    {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p> : null}
  </form>;
}

function AwardResults({ api, surveyId }: { api: Phase1Api; surveyId: string }) {
  const [results, setResults] = useState<AnnualAwardsResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setError(null); setResults(null);
    void api.getAnnualAwardResults(surveyId).then((next) => { if (mounted) setResults(next); }).catch((reason: unknown) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Could not load results.'); });
    return () => { mounted = false; };
  }, [api, surveyId, attempt]);
  return <section className="space-y-4" aria-label="Private award results">
    <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Private results</h3><button type="button" className="min-h-11 px-3 font-bold text-footballBlue" onClick={() => setAttempt((value) => value + 1)}>Refresh results</button></div>
    {error ? <p role="alert" className="text-sm font-semibold text-red-800">{error}</p> : null}
    {!results && !error ? <p role="status" className="text-sm text-navy/70">Loading results...</p> : null}
    {results ? <><p className="text-sm text-navy/70">{results.responseCount} {results.responseCount === 1 ? 'member' : 'members'} responded</p>
      {awardTypes.map((award) => <section key={award} className="border-t border-navy/10 pt-4"><h4 className="text-xl font-bold">{award} ranking</h4>
        {!results.rankings.some((row) => row.award === award) ? <p className="mt-3 text-sm text-navy/70">No votes yet.</p> : null}
        {results.rankings.filter((row) => row.award === award).map((row) => <article key={row.candidateId} className="border-b border-navy/10 py-4">
          <div className="flex justify-between gap-3"><h5 className="min-w-0 break-words font-bold">{row.rank}. {row.first_name}</h5><span className="shrink-0 text-sm font-semibold">{row.votes} {row.votes === 1 ? 'vote' : 'votes'}</span></div>
          <ul className="mt-3 space-y-3">{results.comments.filter((comment) => comment.award === award && comment.candidateId === row.candidateId).map((comment) => <li key={`${comment.voter}:${comment.updatedAt}`}><p className="text-xs font-semibold text-navy/70">{comment.voter}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">{comment.comment}</p></li>)}</ul>
        </article>)}
      </section>)}
    </> : null}
  </section>;
}
