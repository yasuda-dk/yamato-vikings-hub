import { useEffect, useMemo, useState, type ReactNode, type SVGProps } from 'react';
import { downloadSeasonOverviewCsv } from '../lib/analytics-export';
import type { EventSummary } from '../lib/events';
import { eventStatuses, eventTypes } from '../lib/events';
import type { FineBoxState } from '../lib/fines';
import type { AgeGroup, Gender, MemberProfile, Position, ResidenceType } from '../lib/member-options';
import { ageGroups, genders, positions, residenceTypes } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';
import type { PracticePaymentState } from '../lib/practice-payments';

const GENKI_MOBILEPAY_NUMBER = '+4521282316';
const INSTAGRAM_URL = 'https://www.instagram.com/yamato_vikings?igsh=YTE0Y3J4enpubmNu&utm_source=qr';
const YOUTUBE_URL = 'https://www.youtube.com/@YamatoVikings';

type HomePageProps = {
  api: Phase1Api;
  members: MemberProfile[];
  selectedMember: MemberProfile;
  onSwitchProfile: () => void;
};

export function HomePage({ api, members, selectedMember, onSwitchProfile }: HomePageProps) {
  const [practicePayment, setPracticePayment] = useState<PracticePaymentState | null>(null);
  const [paymentLoadState, setPaymentLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const paymentProfileVersion = useMemo(
    () =>
      members
        .map((member) =>
          [
            member.id,
            member.age_group,
            member.residence_type,
            member.membership_status,
            member.practice_payment_rule,
            member.practice_payment_custom_amount_dkk ?? '',
          ].join(':'),
        )
        .join('|'),
    [members],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPracticePayment() {
      try {
        setPaymentLoadState('loading');
        setPaymentError(null);
        const nextPayment = await api.getPracticePayment();
        if (isMounted) {
          setPracticePayment(nextPayment);
          setPaymentLoadState('ready');
        }
      } catch (loadError) {
        if (isMounted) {
          setPaymentError(loadError instanceof Error ? loadError.message : 'Could not load practice payment.');
          setPaymentLoadState('error');
        }
      }
    }

    void loadPracticePayment();

    return () => {
      isMounted = false;
    };
  }, [api, selectedMember.id, selectedMember.age_group, selectedMember.residence_type, selectedMember.practice_payment_rule, selectedMember.practice_payment_custom_amount_dkk, paymentProfileVersion]);

  async function markPracticePaid() {
    if (!practicePayment?.event || isMarkingPaid) return;

    setIsMarkingPaid(true);
    setPaymentError(null);
    setPaymentSuccess(null);
    try {
      const nextPayment = await api.markPracticePaymentPaid(practicePayment.event.id);
      setPracticePayment(nextPayment);
      setPaymentSuccess('Practice payment marked as paid.');
    } catch (paymentError) {
      setPaymentError(paymentError instanceof Error ? paymentError.message : 'Could not mark payment paid.');
    } finally {
      setIsMarkingPaid(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-navy/10 bg-white p-4">
        <p className="text-sm font-semibold text-footballBlue">Submitting as {selectedMember.first_name}</p>
        <h2 className="mt-2 text-xl font-bold text-navy">Home</h2>
        <div className="mt-4 grid gap-3">
          <ContactRow icon={<MobilePayLogo className="h-5 w-5" />} label="MobilePay" value={`Genki ${GENKI_MOBILEPAY_NUMBER}`} />
          <ClubLink icon={<InstagramLogo className="h-5 w-5" />} label="Instagram" href={INSTAGRAM_URL} />
          <ClubLink icon={<YouTubeLogo className="h-5 w-5" />} label="YouTube" href={YOUTUBE_URL} />
        </div>
        <button type="button" onClick={onSwitchProfile} className="mt-5 min-h-12 w-full rounded-md border border-navy/20 bg-white px-4 text-base font-bold text-navy">
          Switch profile
        </button>
      </div>

      <PracticePaymentPanel
        state={practicePayment}
        loadState={paymentLoadState}
        error={paymentError}
        success={paymentSuccess}
        isAdmin={selectedMember.application_role === 'Admin'}
        isMarkingPaid={isMarkingPaid}
        onMarkPaid={markPracticePaid}
      />

      {selectedMember.application_role === 'Admin' ? <AnalyticsOverview api={api} members={members} /> : null}
    </section>
  );
}

function PracticePaymentPanel({
  state,
  loadState,
  error,
  success,
  isAdmin,
  isMarkingPaid,
  onMarkPaid,
}: {
  state: PracticePaymentState | null;
  loadState: 'loading' | 'ready' | 'error';
  error: string | null;
  success: string | null;
  isAdmin: boolean;
  isMarkingPaid: boolean;
  onMarkPaid: () => Promise<void>;
}) {
  const myPayment = state?.myPayment ?? null;
  const canMarkPaid = Boolean(state?.event && myPayment?.rsvp_status === 'Going' && !myPayment.is_paid && !myPayment.is_exempt && !isMarkingPaid);
  const canViewPaymentTracking = isAdmin || Boolean(state?.adminPayments.length);
  const amountLabel = myPayment?.is_exempt ? 'Exempt' : myPayment ? `${myPayment.amount_dkk} kr` : '-';
  const statusLabel = myPayment?.is_exempt ? 'Exempt' : myPayment?.is_paid ? 'Paid' : myPayment?.rsvp_status === 'Going' ? 'Not paid' : 'RSVP Going first';

  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4">
      <p className="text-sm font-semibold text-footballBlue">Practice</p>
      <h2 className="mt-1 text-xl font-bold text-navy">Payment</h2>

      {loadState === 'loading' ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-12 rounded-md bg-mist" />
          <div className="h-12 rounded-md bg-mist" />
        </div>
      ) : null}

      {loadState === 'error' ? (
        <p className="mt-4 rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
          {error ?? 'Could not load practice payment.'}
        </p>
      ) : null}

      {loadState === 'ready' && !state?.event ? <p className="mt-4 rounded-md bg-mist p-3 text-sm text-navy/70">No Practice payment is open right now.</p> : null}

      {loadState === 'ready' && state?.event ? (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2">
            <ProfileRow label="Practice" value={formatPracticeDate(state.event.event_date, state.event.start_time)} />
            <ProfileRow label="Deadline" value={formatPracticeDeadline(state.event.payment_deadline_date)} />
            <ProfileRow label="Amount" value={amountLabel} />
            <ProfileRow label="Status" value={statusLabel} />
          </div>
          {myPayment?.is_exempt ? (
            <p className="rounded-md bg-mist p-3 text-sm leading-5 text-navy/70">No Practice payment is required for this profile.</p>
          ) : (
            <p className="rounded-md bg-mist p-3 text-sm leading-5 text-navy/70">Pay Genki by MobilePay at {GENKI_MOBILEPAY_NUMBER}, then tap the button below.</p>
          )}
          {success ? <p className="rounded-md border border-footballBlue/20 bg-white p-3 text-sm font-semibold text-footballBlue">{success}</p> : null}
          {error ? (
            <p className="rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {myPayment?.is_exempt ? null : (
            <button type="button" disabled={!canMarkPaid} onClick={() => void onMarkPaid()} className="min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
              {myPayment?.is_paid ? 'Paid' : isMarkingPaid ? 'Saving...' : 'Mark as paid'}
            </button>
          )}
          {!myPayment?.is_exempt && !myPayment?.is_paid && myPayment?.rsvp_status !== 'Going' ? <p className="text-sm font-semibold text-navy/70">This button is available after your RSVP is Going.</p> : null}
          {canViewPaymentTracking ? <PracticePaymentTracking state={state} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PracticePaymentTracking({ state }: { state: PracticePaymentState }) {
  return (
    <div className="rounded-md bg-mist p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-navy">Payment tracking</p>
          <p className="mt-1 text-xs font-semibold text-navy/60">
            {state.totals.paid_count} paid · {state.totals.unpaid_count} not paid · {state.totals.exempt_count} exempt
          </p>
        </div>
        <span className="shrink-0 rounded bg-white px-2 py-1 text-xs font-bold text-navy">{state.totals.paid_total_dkk}/{state.totals.expected_total_dkk} kr</span>
      </div>
      {state.adminPayments.length === 0 ? (
        <p className="mt-3 text-sm text-navy/70">No Going members for this Practice yet.</p>
      ) : (
        <div className="mt-3 divide-y divide-navy/10">
          {state.adminPayments.map((payment) => (
            <div key={payment.member_id} className="flex min-h-11 items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-navy">{payment.first_name}</p>
                <p className="text-xs font-semibold text-navy/60">{payment.is_exempt ? 'Exempt' : `${payment.amount_dkk} kr${payment.payment_rule === 'Custom' ? ' · Custom' : ''}`}</p>
              </div>
              <span className="shrink-0 rounded bg-white px-2 py-1 text-xs font-bold text-navy">{payment.is_exempt ? 'Exempt' : payment.is_paid ? 'Paid' : 'Not paid'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-mist px-3">
      <span className="text-sm text-navy/65">{label}</span>
      <span className="text-sm font-bold text-navy">{value}</span>
    </div>
  );
}

function ContactRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-mist px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-navy/65">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-white text-footballBlue" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </span>
      <span className="text-right font-bold text-navy">{value}</span>
    </div>
  );
}

function ClubLink({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-mist px-3 py-2 text-sm font-bold text-navy">
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-white text-footballBlue" aria-hidden="true">
          {icon}
        </span>
        <span className="text-navy/65">{label}</span>
      </span>
      <span className="text-right text-footballBlue">Open Yamato Vikings</span>
    </a>
  );
}

function MobilePayLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" fill="#ffffff" stroke="#5b7fff" strokeWidth="2" />
      <path d="M9 6h6" stroke="#5b7fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 13.5c1.2-2.4 2.6-2.4 4.2 0 1.2 1.7 2.1 1.7 2.8 0" stroke="#00a6d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="18" r="1" fill="#5b7fff" />
    </svg>
  );
}

function InstagramLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="#ffffff" stroke="#e1306c" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="#833ab4" strokeWidth="2" />
      <circle cx="17" cy="7" r="1.2" fill="#f77737" />
    </svg>
  );
}

function YouTubeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="3.5" fill="#ff0033" />
      <path d="m10 9 5 3-5 3V9Z" fill="#ffffff" />
    </svg>
  );
}

function formatPracticeDate(date: string, time: string) {
  const value = new Date(`${date}T${time}`);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function formatPracticeDeadline(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function AnalyticsOverview({ api, members }: { api: Phase1Api; members: MemberProfile[] }) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [fineBox, setFineBox] = useState<FineBoxState | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const seasonYear = new Date().getFullYear();

  useEffect(() => {
    let isMounted = true;

    async function loadAnalytics() {
      try {
        setLoadState('loading');
        setError(null);
        const [nextEvents, nextFineBox] = await Promise.all([api.listAnalyticsEvents(seasonYear), api.getFineBox()]);
        if (isMounted) {
          setEvents(nextEvents);
          setFineBox(nextFineBox);
          setLoadState('ready');
        }
      } catch (analyticsError) {
        if (isMounted) {
          setError(analyticsError instanceof Error ? analyticsError.message : 'Could not load analytics.');
          setLoadState('error');
        }
      }
    }

    void loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [api, seasonYear]);

  const stats = useMemo(() => {
    const activeMembers = members.filter((member) => member.membership_status === 'Active');
    const inactiveMembers = members.filter((member) => member.membership_status === 'Inactive');
    const averageLevel = activeMembers.length > 0 ? activeMembers.reduce((total, member) => total + member.football_level, 0) / activeMembers.length : 0;
    const byAgeGroup = countBy(activeMembers, ageGroups, (member) => member.age_group);
    const byResidenceType = countBy(activeMembers, residenceTypes, (member) => member.residence_type);
    const byPosition = countBy(activeMembers, positions, (member) => member.primary_position);
    const byGender = countBy(activeMembers, genders, (member) => member.gender);
    const byEventType = countValues(events, eventTypes, (event) => event.event_type);
    const byEventStatus = countValues(events, eventStatuses, (event) => event.status);
    const openEvents = events.filter((event) => event.status !== 'Completed' && event.status !== 'Cancelled');
    const completedEvents = events.filter((event) => event.status === 'Completed');
    const goingResponses = events.reduce((total, event) => total + event.going_count, 0);
    const maybeResponses = events.reduce((total, event) => total + event.maybe_count, 0);
    const notGoingResponses = events.reduce((total, event) => total + event.not_going_count, 0);
    const lateArrivals = events.reduce((total, event) => total + event.late_count, 0);
    const fineSummary = fineBox?.summary ?? {
      unpaid_total_dkk: 0,
      payment_reported_total_dkk: 0,
      paid_total_dkk: 0,
      waived_total_dkk: 0,
    };

    return {
      activeMembers: activeMembers.length,
      inactiveMembers: inactiveMembers.length,
      averageLevel,
      byAgeGroup,
      byResidenceType,
      byPosition,
      byGender,
      byEventType,
      byEventStatus,
      openEvents: openEvents.length,
      completedEvents: completedEvents.length,
      goingResponses,
      lateArrivals,
      rsvpTotals: [
        { label: 'Going', count: goingResponses },
        { label: 'Maybe', count: maybeResponses },
        { label: 'Not going', count: notGoingResponses },
        { label: 'Late arrivals', count: lateArrivals },
      ],
      fineCount: fineBox?.fines.length ?? 0,
      fineTotals: [
        { label: 'Unpaid', count: `${fineSummary.unpaid_total_dkk} DKK` },
        { label: 'Payment reported', count: `${fineSummary.payment_reported_total_dkk} DKK` },
        { label: 'Paid', count: `${fineSummary.paid_total_dkk} DKK` },
        { label: 'Waived', count: `${fineSummary.waived_total_dkk} DKK` },
      ],
    };
  }, [events, fineBox, members]);

  function handleExportCsv() {
    if (!fineBox) return;

    try {
      downloadSeasonOverviewCsv({ seasonYear, members, events, fineBox });
      setExportStatus('success');
    } catch {
      setExportStatus('error');
    }
  }

  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4">
      <p className="text-sm font-semibold text-footballBlue">Admin</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-navy">Season overview</h2>
          <p className="mt-2 text-sm leading-5 text-navy/70">Calendar-year snapshot from current members, events, and fines.</p>
        </div>
        <span className="shrink-0 rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{seasonYear}</span>
      </div>

      {loadState === 'loading' ? (
        <div className="mt-4 grid grid-cols-2 gap-2" aria-busy="true">
          <div className="h-16 rounded-md bg-mist" />
          <div className="h-16 rounded-md bg-mist" />
          <div className="h-16 rounded-md bg-mist" />
          <div className="h-16 rounded-md bg-mist" />
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="mt-4 rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
          {error ?? 'Could not load analytics.'}
        </div>
      ) : null}

      {loadState === 'ready' ? (
        <div className="mt-4 grid gap-3">
          <button type="button" onClick={handleExportCsv} className="min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white">
            Export CSV
          </button>
          {exportStatus === 'success' ? <p className="rounded-md border border-footballBlue/20 bg-white p-3 text-sm font-semibold text-footballBlue">CSV export created.</p> : null}
          {exportStatus === 'error' ? (
            <p className="rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
              Could not create CSV export.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Active members" value={String(stats.activeMembers)} />
            <MetricTile label="Inactive members" value={String(stats.inactiveMembers)} />
            <MetricTile label="Average level" value={stats.averageLevel > 0 ? stats.averageLevel.toFixed(1) : '0.0'} />
            <MetricTile label="Open events" value={String(stats.openEvents)} />
            <MetricTile label="Completed events" value={String(stats.completedEvents)} />
            <MetricTile label="Going responses" value={String(stats.goingResponses)} />
            <MetricTile label="Late arrivals" value={String(stats.lateArrivals)} />
            <MetricTile label="Fine records" value={String(stats.fineCount)} />
          </div>
          <BreakdownSection title="Fine totals" rows={stats.fineTotals} />
          <BreakdownSection title="Events by type" rows={stats.byEventType} />
          <BreakdownSection title="Events by status" rows={stats.byEventStatus} />
          <BreakdownSection title="RSVP totals" rows={stats.rsvpTotals} />
          <BreakdownSection title="Members by position" rows={stats.byPosition} />
          <BreakdownSection title="Members by age group" rows={stats.byAgeGroup} />
          <BreakdownSection title="Members by residence" rows={stats.byResidenceType} />
          <BreakdownSection title="Members by gender" rows={stats.byGender} />
          {events.length === 0 && members.length === 0 ? <p className="text-sm text-navy/70">Analytics will fill in after members and events are created.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function countBy<T extends string>(members: MemberProfile[], values: readonly T[], getValue: (member: MemberProfile) => T) {
  return values
    .map((value) => ({
      label: value,
      count: members.filter((member) => getValue(member) === value).length,
    }))
    .filter((row) => row.count > 0);
}

function countValues<TItem, TValue extends string>(items: TItem[], values: readonly TValue[], getValue: (item: TItem) => TValue) {
  return values
    .map((value) => ({
      label: value,
      count: items.filter((item) => getValue(item) === value).length,
    }))
    .filter((row) => row.count > 0);
}

function BreakdownSection({ title, rows }: { title: string; rows: Array<{ label: AgeGroup | ResidenceType | Position | Gender | string; count: number | string }> }) {
  return (
    <div className="rounded-md bg-mist p-3">
      <h3 className="text-sm font-bold text-navy">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-navy/70">No active member data yet.</p>
      ) : (
        <div className="mt-2 divide-y divide-navy/10">
          {rows.map((row) => (
            <div key={row.label} className="flex min-h-10 items-center justify-between gap-3 py-2">
              <span className="break-words text-sm font-semibold text-navy/70">{row.label}</span>
              <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-navy">{row.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-mist p-3">
      <p className="text-xs font-bold text-navy/60">{label}</p>
      <p className="mt-1 text-lg font-bold text-navy">{value}</p>
    </div>
  );
}
