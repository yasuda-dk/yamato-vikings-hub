import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { ActualStatus, EventDetail, EventGuestInput, EventParticipant, RsvpInput, RsvpStatus } from '../lib/events';
import { actualStatuses, createDefaultGuestInput, formatEventDate, rsvpStatuses, validateEventGuestInput, validateRsvpInput } from '../lib/events';
import { ageGroups, formatFootballLevel, footballLevelLabels, footballLevels, genders, positions, residenceTypes, type MemberProfile, type SecondaryPosition } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';

type EventDetailPageProps = {
  api: Phase1Api;
  selectedMember: MemberProfile;
};

export function EventDetailPage({ api, selectedMember }: EventDetailPageProps) {
  const { eventId } = useParams();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [guestDraft, setGuestDraft] = useState<EventGuestInput>(() => createDefaultGuestInput(eventId ?? ''));
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [draft, setDraft] = useState<RsvpInput>({
    eventId: eventId ?? '',
    rsvpStatus: 'Going',
    isArrivingLate: false,
    expectedArrivalTime: '',
  });

  useEffect(() => {
    if (!detail || !eventId) return;
    setDraft({
      eventId,
      rsvpStatus: detail.myRsvp?.rsvp_status ?? 'Going',
      isArrivingLate: detail.myRsvp?.is_arriving_late ?? false,
      expectedArrivalTime: detail.myRsvp?.expected_arrival_time?.slice(0, 5) ?? '',
    });
    setGuestDraft((current) => ({ ...current, eventId }));
  }, [detail, eventId]);

  useEffect(() => {
    if (!eventId) return;
    const currentEventId = eventId;
    let isMounted = true;

    async function loadDetail() {
      try {
        setLoadState('loading');
        setError(null);
        const nextDetail = await api.getEventDetail(currentEventId);
        if (isMounted) {
          setDetail(nextDetail);
          setLoadState('ready');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load event.');
          setLoadState('error');
        }
      }
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [api, eventId]);

  const validationError = useMemo(() => validateRsvpInput(draft), [draft]);
  const guestErrors = useMemo(() => validateEventGuestInput(guestDraft, detail?.participants ?? []), [guestDraft, detail?.participants]);
  const saveDisabled = isSaving || Boolean(validationError) || loadState !== 'ready' || detail?.event.status === 'Cancelled';
  const isAdmin = selectedMember.application_role === 'Admin';

  if (!eventId) {
    return <Navigate to="/events" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saveDisabled) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const currentEventId = draft.eventId;
      await api.updateRsvp(draft);
      const nextDetail = await api.getEventDetail(currentEventId);
      setDetail(nextDetail);
      setSuccess('RSVP updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update RSVP.');
    } finally {
      setIsSaving(false);
    }
  }

  function updateStatus(rsvpStatus: RsvpStatus) {
    setDraft((current) => ({
      ...current,
      rsvpStatus,
      isArrivingLate: rsvpStatus === 'Going' ? current.isArrivingLate : false,
      expectedArrivalTime: rsvpStatus === 'Going' ? current.expectedArrivalTime : '',
    }));
  }

  async function refreshDetail(message: string) {
    const nextDetail = await api.getEventDetail(draft.eventId);
    setDetail(nextDetail);
    setSuccess(message);
  }

  async function updateMemberAttendance(memberId: string, actualStatus: ActualStatus) {
    setAdminBusyId(memberId);
    setError(null);
    setSuccess(null);
    try {
      await api.updateAttendance({ eventId: draft.eventId, memberId, actualStatus });
      await refreshDetail('Attendance updated.');
    } catch (attendanceError) {
      setError(attendanceError instanceof Error ? attendanceError.message : 'Could not update attendance.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function updateGuestAttendance(eventGuestId: string, actualStatus: ActualStatus) {
    setAdminBusyId(eventGuestId);
    setError(null);
    setSuccess(null);
    try {
      await api.updateGuestAttendance({ eventGuestId, actualStatus });
      await refreshDetail('Guest attendance updated.');
    } catch (attendanceError) {
      setError(attendanceError instanceof Error ? attendanceError.message : 'Could not update guest attendance.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function handleCreateGuest(event: FormEvent) {
    event.preventDefault();
    if (Object.keys(guestErrors).length > 0 || adminBusyId === 'guest-form') return;

    setAdminBusyId('guest-form');
    setError(null);
    setSuccess(null);
    try {
      await api.createEventGuest(guestDraft);
      setGuestDraft(createDefaultGuestInput(draft.eventId));
      setShowGuestForm(false);
      await refreshDetail('Guest added.');
    } catch (guestError) {
      setError(guestError instanceof Error ? guestError.message : 'Could not add guest.');
    } finally {
      setAdminBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <Link to="/events" className="inline-flex min-h-11 items-center rounded-md text-sm font-bold text-footballBlue">
        Back to events
      </Link>

      {loadState === 'loading' ? <DetailLoading /> : null}
      {loadState === 'error' ? (
        <div className="rounded-lg border border-navy/10 bg-white p-4">
          <h2 className="text-xl font-bold text-navy">Event unavailable</h2>
          <p className="mt-2 text-sm text-navy/70">{error ?? 'Try again after checking your connection.'}</p>
        </div>
      ) : null}

      {loadState === 'ready' && detail ? (
        <>
          <div className="rounded-lg border border-navy/10 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-footballBlue">{detail.event.event_type}</p>
                <h2 className="mt-1 break-words text-xl font-bold text-navy">{detail.event.title}</h2>
              </div>
              <span className="shrink-0 rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{detail.event.status}</span>
            </div>
            <div className="mt-4 grid gap-2">
              <InfoRow label="When" value={formatEventDate(detail.event.event_date, detail.event.start_time)} />
              <InfoRow label="Where" value={detail.event.location} />
              <InfoRow label="Submitting as" value={selectedMember.first_name} />
            </div>
            {detail.event.notes ? <p className="mt-4 rounded-md bg-mist p-3 text-sm leading-5 text-navy/75">{detail.event.notes}</p> : null}
          </div>

          <div className="rounded-lg border border-navy/10 bg-white p-4">
            <h3 className="text-base font-bold text-navy">Participants</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Count label="Going" value={detail.counts.going} />
              <Count label="Late" value={detail.counts.late} />
              <Count label="Maybe" value={detail.counts.maybe} />
              <Count label="Not going" value={detail.counts.notGoing} />
              <Count label="Attended" value={detail.counts.attended} />
              <Count label="Guests" value={detail.counts.guests} />
            </div>
          </div>

          {isAdmin ? (
            <div className="rounded-lg border border-navy/10 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-footballBlue">Admin</p>
                  <h3 className="mt-1 text-base font-bold text-navy">Attendance</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuestForm((current) => !current)}
                  className="min-h-11 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue"
                >
                  {showGuestForm ? 'Close' : 'Add guest'}
                </button>
              </div>

              {showGuestForm ? (
                <form onSubmit={handleCreateGuest} className="mt-4 space-y-4">
                  <TextInput label="Guest first name" value={guestDraft.firstName} error={guestErrors.firstName} onChange={(firstName) => setGuestDraft((current) => ({ ...current, firstName }))} />
                  <Select label="Age group" value={guestDraft.ageGroup} options={ageGroups} onChange={(ageGroup) => setGuestDraft((current) => ({ ...current, ageGroup }))} />
                  <Select
                    label="Football level"
                    value={String(guestDraft.footballLevel)}
                    options={footballLevels.map(String)}
                    getOptionLabel={(footballLevel) => formatFootballLevel(Number(footballLevel) as keyof typeof footballLevelLabels)}
                    onChange={(footballLevel) => setGuestDraft((current) => ({ ...current, footballLevel: Number(footballLevel) as EventGuestInput['footballLevel'] }))}
                  />
                  <Select label="Primary position" value={guestDraft.primaryPosition} options={positions} onChange={(primaryPosition) => setGuestDraft((current) => ({ ...current, primaryPosition }))} />
                  <Select
                    label="Secondary position"
                    value={guestDraft.secondaryPosition}
                    options={['None', ...positions]}
                    error={guestErrors.secondaryPosition}
                    onChange={(secondaryPosition) => setGuestDraft((current) => ({ ...current, secondaryPosition: secondaryPosition as SecondaryPosition }))}
                  />
                  <Select label="Residence type" value={guestDraft.residenceType} options={residenceTypes} onChange={(residenceType) => setGuestDraft((current) => ({ ...current, residenceType }))} />
                  <Select label="Gender" value={guestDraft.gender} options={genders} onChange={(gender) => setGuestDraft((current) => ({ ...current, gender }))} />
                  <button type="submit" disabled={Object.keys(guestErrors).length > 0 || adminBusyId === 'guest-form'} className="min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
                    {adminBusyId === 'guest-form' ? 'Adding...' : 'Add guest'}
                  </button>
                </form>
              ) : null}

              <div className="mt-4 space-y-2">
                {detail.participants.length === 0 ? <p className="rounded-md bg-mist p-3 text-sm text-navy/70">No participants yet.</p> : null}
                {detail.participants.map((participant) => (
                  <ParticipantRow
                    key={`${participant.kind}-${participant.id}`}
                    participant={participant}
                    busy={adminBusyId === participant.id}
                    onMemberAttendance={updateMemberAttendance}
                    onGuestAttendance={updateGuestAttendance}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="rounded-lg border border-navy/10 bg-white p-4">
            <h3 className="text-base font-bold text-navy">Your RSVP</h3>
            {detail.myRsvp?.was_updated_after_deadline ? <p className="mt-2 text-sm font-semibold text-navy">Late response recorded</p> : null}
            {error ? (
              <p className="mt-3 rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
                {error}
              </p>
            ) : null}
            {success ? <p className="mt-3 rounded-md border border-footballBlue/20 bg-white p-3 text-sm font-semibold text-footballBlue">{success}</p> : null}

            <div className="mt-4 grid grid-cols-3 gap-2">
              {rsvpStatuses.map((status) => (
                <button key={status} type="button" onClick={() => updateStatus(status)} className={rsvpButtonClass(draft.rsvpStatus === status)}>
                  {status}
                </button>
              ))}
            </div>

            <label className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-md bg-mist px-3 text-sm font-semibold text-navy">
              <span>I’ll be late</span>
              <input
                type="checkbox"
                checked={draft.isArrivingLate}
                disabled={draft.rsvpStatus !== 'Going'}
                onChange={(event) => setDraft((current) => ({ ...current, isArrivingLate: event.target.checked, expectedArrivalTime: event.target.checked ? current.expectedArrivalTime : '' }))}
                className="h-5 w-5 accent-footballBlue disabled:opacity-50"
              />
            </label>

            {draft.rsvpStatus === 'Going' && draft.isArrivingLate ? (
              <label className="mt-4 block text-sm font-semibold text-navy">
                Expected arrival time
                <input
                  aria-label="Expected arrival time"
                  type="time"
                  value={draft.expectedArrivalTime}
                  onChange={(event) => setDraft((current) => ({ ...current, expectedArrivalTime: event.target.value }))}
                  className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base"
                />
              </label>
            ) : null}

            {validationError ? <p className="mt-3 text-sm font-semibold text-red-700">{validationError}</p> : null}
            {detail.event.status === 'Cancelled' ? <p className="mt-3 text-sm font-semibold text-navy/70">RSVP is disabled because this event is cancelled.</p> : null}
            <button type="submit" disabled={saveDisabled} className="mt-5 min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
              {isSaving ? 'Updating...' : 'Update RSVP'}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}

function ParticipantRow({
  participant,
  busy,
  onMemberAttendance,
  onGuestAttendance,
}: {
  participant: EventParticipant;
  busy: boolean;
  onMemberAttendance: (memberId: string, actualStatus: ActualStatus) => Promise<void>;
  onGuestAttendance: (eventGuestId: string, actualStatus: ActualStatus) => Promise<void>;
}) {
  async function updateStatus(actualStatus: ActualStatus) {
    if (participant.kind === 'member') {
      await onMemberAttendance(participant.id, actualStatus);
      return;
    }

    await onGuestAttendance(participant.id, actualStatus);
  }

  return (
    <div className="rounded-md bg-mist p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-bold text-navy">{participant.first_name}</p>
            {participant.kind === 'guest' ? <span className="rounded bg-white px-2 py-1 text-xs font-bold text-footballBlue">GUEST</span> : null}
          </div>
          <p className="mt-1 text-xs font-semibold text-navy/65">
            {participant.rsvp_status ?? 'Guest'} · {participant.primary_position} · Level {participant.football_level}
          </p>
        </div>
        <span className="shrink-0 rounded bg-white px-2 py-1 text-xs font-bold text-navy">{participant.actual_status}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {actualStatuses.map((status) => (
          <button key={status} type="button" disabled={busy} onClick={() => updateStatus(status)} className={actualStatusButtonClass(participant.actual_status === status)}>
            {status === 'Not confirmed' ? 'Unset' : status}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-mist px-3">
      <span className="text-sm text-navy/65">{label}</span>
      <span className="text-right text-sm font-bold text-navy">{value}</span>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-mist px-3 py-2">
      <p className="text-xl font-bold text-navy">{value}</p>
      <p className="text-xs font-semibold text-navy/65">{label}</p>
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4" aria-busy="true">
      <p className="text-sm font-semibold text-footballBlue">Loading event</p>
      <div className="mt-4 space-y-3">
        <div className="h-20 rounded-md bg-mist" />
        <div className="h-28 rounded-md bg-mist" />
      </div>
    </div>
  );
}

function rsvpButtonClass(isActive: boolean) {
  return ['min-h-11 rounded-md px-2 text-sm font-bold', isActive ? 'bg-footballBlue text-white' : 'bg-mist text-navy'].join(' ');
}

function actualStatusButtonClass(isActive: boolean) {
  return ['min-h-11 rounded-md px-1 text-xs font-bold', isActive ? 'bg-footballBlue text-white' : 'bg-white text-navy'].join(' ');
}

function TextInput({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base" />
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  getOptionLabel = (option) => option,
}: {
  label: string;
  value: string;
  options: readonly T[];
  onChange: (value: T) => void;
  error?: string;
  getOptionLabel?: (value: T) => string;
}) {
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)} className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base">
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
  );
}
