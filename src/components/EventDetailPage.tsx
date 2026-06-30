import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { EventDetail, RsvpInput, RsvpStatus } from '../lib/events';
import { formatEventDate, rsvpStatuses, validateRsvpInput } from '../lib/events';
import type { MemberProfile } from '../lib/member-options';
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
  const saveDisabled = isSaving || Boolean(validationError) || loadState !== 'ready' || detail?.event.status === 'Cancelled';

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
            </div>
          </div>

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
