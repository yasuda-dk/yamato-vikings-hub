import { useEffect, useMemo, useState } from 'react';
import type { EventSummary } from '../lib/events';
import type { FineBoxState } from '../lib/fines';
import type { AgeGroup, Gender, MemberProfile, Position, ResidenceType } from '../lib/member-options';
import { ageGroups, formatFootballLevel, genders, positions, residenceTypes } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';

type HomePageProps = {
  api: Phase1Api;
  members: MemberProfile[];
  selectedMember: MemberProfile;
  onSwitchProfile: () => void;
};

export function HomePage({ api, members, selectedMember, onSwitchProfile }: HomePageProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-navy/10 bg-white p-4">
        <p className="text-sm font-semibold text-footballBlue">Submitting as {selectedMember.first_name}</p>
        <h2 className="mt-2 text-xl font-bold text-navy">Home</h2>
        <div className="mt-4 grid gap-3">
          <ProfileRow label="Age group" value={selectedMember.age_group} />
          <ProfileRow label="Football level" value={formatFootballLevel(selectedMember.football_level)} />
          <ProfileRow label="Primary position" value={selectedMember.primary_position} />
          <ProfileRow label="Secondary position" value={selectedMember.secondary_position ?? 'None'} />
          <ProfileRow label="Residence type" value={selectedMember.residence_type} />
          <ProfileRow label="Gender" value={selectedMember.gender} />
        </div>
        <button type="button" onClick={onSwitchProfile} className="mt-5 min-h-12 w-full rounded-md border border-navy/20 bg-white px-4 text-base font-bold text-navy">
          Switch profile
        </button>
      </div>

      {selectedMember.application_role === 'Admin' ? <AnalyticsOverview api={api} members={members} /> : null}
    </section>
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

function AnalyticsOverview({ api, members }: { api: Phase1Api; members: MemberProfile[] }) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [fineBox, setFineBox] = useState<FineBoxState | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const seasonYear = new Date().getFullYear();

  useEffect(() => {
    let isMounted = true;

    async function loadAnalytics() {
      try {
        setLoadState('loading');
        setError(null);
        const [nextEvents, nextFineBox] = await Promise.all([api.listEvents(), api.getFineBox()]);
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
  }, [api]);

  const stats = useMemo(() => {
    const activeMembers = members.filter((member) => member.membership_status === 'Active');
    const inactiveMembers = members.filter((member) => member.membership_status === 'Inactive');
    const averageLevel = activeMembers.length > 0 ? activeMembers.reduce((total, member) => total + member.football_level, 0) / activeMembers.length : 0;
    const byAgeGroup = countBy(activeMembers, ageGroups, (member) => member.age_group);
    const byResidenceType = countBy(activeMembers, residenceTypes, (member) => member.residence_type);
    const byPosition = countBy(activeMembers, positions, (member) => member.primary_position);
    const byGender = countBy(activeMembers, genders, (member) => member.gender);
    const openEvents = events.filter((event) => event.status !== 'Completed' && event.status !== 'Cancelled');
    const completedEvents = events.filter((event) => event.status === 'Completed');
    const goingResponses = events.reduce((total, event) => total + event.going_count, 0);
    const lateArrivals = events.reduce((total, event) => total + event.late_count, 0);

    return {
      activeMembers: activeMembers.length,
      inactiveMembers: inactiveMembers.length,
      averageLevel,
      byAgeGroup,
      byResidenceType,
      byPosition,
      byGender,
      openEvents: openEvents.length,
      completedEvents: completedEvents.length,
      goingResponses,
      lateArrivals,
    };
  }, [events, members]);

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
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Active members" value={String(stats.activeMembers)} />
            <MetricTile label="Inactive members" value={String(stats.inactiveMembers)} />
            <MetricTile label="Average level" value={stats.averageLevel > 0 ? stats.averageLevel.toFixed(1) : '0.0'} />
            <MetricTile label="Open events" value={String(stats.openEvents)} />
            <MetricTile label="Completed events" value={String(stats.completedEvents)} />
            <MetricTile label="Going responses" value={String(stats.goingResponses)} />
            <MetricTile label="Late arrivals" value={String(stats.lateArrivals)} />
            <MetricTile label="Unpaid fines" value={`${fineBox?.summary.unpaid_total_dkk ?? 0} DKK`} />
          </div>
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

function BreakdownSection({ title, rows }: { title: string; rows: Array<{ label: AgeGroup | ResidenceType | Position | Gender; count: number }> }) {
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
