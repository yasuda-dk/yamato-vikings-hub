import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EventCreateInput, EventSummary, EventType } from '../lib/events';
import { defaultEventSettings, eventTypes, filterUpcomingEvents, formatEventDate, validateEventInput } from '../lib/events';
import type { MemberProfile } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';

type EventsPageProps = {
  api: Phase1Api;
  selectedMember: MemberProfile;
};

const defaultCreateEvent: EventCreateInput = {
  title: '',
  eventType: 'Football',
  eventDate: '',
  startTime: '19:00',
  location: '',
  rsvpDeadline: '',
  numberOfTeams: 2,
  notes: '',
  enableTeamGeneration: true,
  enableVoting: true,
  status: 'Open',
};

export function EventsPage({ api, selectedMember }: EventsPageProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<EventCreateInput>(defaultCreateEvent);
  const isAdmin = selectedMember.application_role === 'Admin';
  const fieldErrors = useMemo(() => validateEventInput(draft), [draft]);
  const createDisabled = isCreating || Object.keys(fieldErrors).length > 0;

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        setLoadState('loading');
        setError(null);
        const nextEvents = await api.listEvents();
        if (isMounted) {
          setEvents(filterUpcomingEvents(nextEvents));
          setLoadState('ready');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load events.');
          setLoadState('error');
        }
      }
    }

    void loadEvents();

    return () => {
      isMounted = false;
    };
  }, [api]);

  function updateEventType(eventType: EventType) {
    setDraft((current) => ({ ...current, eventType, ...defaultEventSettings(eventType) }));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (createDisabled) return;

    setIsCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const eventId = await api.createEvent({
        ...draft,
        rsvpDeadline: new Date(draft.rsvpDeadline).toISOString(),
      });
      setSuccess('Event created.');
      navigate(`/events/${eventId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create event.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-navy/10 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-footballBlue">Sessions</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Events</h2>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowCreate((current) => !current)}
              className="min-h-11 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue"
            >
              {showCreate ? 'Close' : 'Create'}
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-5 text-navy/70">Check the next session and keep your RSVP current.</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {success ? <div className="rounded-md border border-footballBlue/20 bg-white p-3 text-sm font-semibold text-footballBlue">{success}</div> : null}

      {showCreate && isAdmin ? (
        <form onSubmit={handleCreate} className="rounded-lg border border-navy/10 bg-white p-4">
          <h3 className="text-base font-bold text-navy">Create event</h3>
          <div className="mt-4 space-y-4">
            <TextInput label="Title" value={draft.title} error={fieldErrors.title} onChange={(title) => setDraft((current) => ({ ...current, title }))} />
            <Select label="Event type" value={draft.eventType} options={eventTypes} onChange={updateEventType} />
            <TextInput label="Date" type="date" value={draft.eventDate} error={fieldErrors.eventDate} onChange={(eventDate) => setDraft((current) => ({ ...current, eventDate }))} />
            <TextInput label="Start time" type="time" value={draft.startTime} error={fieldErrors.startTime} onChange={(startTime) => setDraft((current) => ({ ...current, startTime }))} />
            <TextInput label="Location" value={draft.location} error={fieldErrors.location} onChange={(location) => setDraft((current) => ({ ...current, location }))} />
            <TextInput
              label="RSVP deadline"
              type="datetime-local"
              value={draft.rsvpDeadline}
              error={fieldErrors.rsvpDeadline}
              onChange={(rsvpDeadline) => setDraft((current) => ({ ...current, rsvpDeadline }))}
            />
            <Select
              label="Number of teams"
              value={String(draft.numberOfTeams)}
              options={['2', '3', '4']}
              error={fieldErrors.numberOfTeams}
              onChange={(numberOfTeams) => setDraft((current) => ({ ...current, numberOfTeams: Number(numberOfTeams) }))}
            />
            <label className="block text-sm font-semibold text-navy">
              Notes
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className="mt-2 min-h-24 w-full rounded-md border border-navy/20 px-3 py-2 text-base"
              />
            </label>
            <Toggle label="Enable team generation" checked={draft.enableTeamGeneration} onChange={(enableTeamGeneration) => setDraft((current) => ({ ...current, enableTeamGeneration }))} />
            <Toggle label="Enable voting" checked={draft.enableVoting} onChange={(enableVoting) => setDraft((current) => ({ ...current, enableVoting }))} />
          </div>
          <button type="submit" disabled={createDisabled} className="mt-5 min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
            {isCreating ? 'Creating...' : 'Create event'}
          </button>
        </form>
      ) : null}

      {loadState === 'loading' ? <EventsLoading /> : null}
      {loadState === 'error' ? (
        <div className="rounded-lg border border-navy/10 bg-white p-4">
          <h3 className="text-base font-bold text-navy">Events unavailable</h3>
          <p className="mt-2 text-sm text-navy/70">Try again after checking your connection.</p>
        </div>
      ) : null}
      {loadState === 'ready' && events.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white p-4">
          <h3 className="text-base font-bold text-navy">No events yet</h3>
          <p className="mt-2 text-sm text-navy/70">{isAdmin ? 'Create the first football session when the date is ready.' : 'An admin will add the next session here.'}</p>
        </div>
      ) : null}
      {loadState === 'ready' && events.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EventRow({ event }: { event: EventSummary }) {
  return (
    <Link to={`/events/${event.id}`} className="block border-b border-navy/10 px-4 py-3 last:border-b-0 focus:outline-none focus:ring-2 focus:ring-footballBlue">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold text-navy">{event.title}</h3>
          <p className="mt-1 text-sm font-semibold text-navy/70">{formatEventDate(event.event_date, event.start_time)}</p>
          <p className="mt-1 text-sm text-navy/60">{event.location}</p>
        </div>
        <span className="shrink-0 rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{event.status}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-md bg-footballBlue/10 px-2 py-1 text-footballBlue">{event.going_count} going</span>
        <span className="rounded-md bg-mist px-2 py-1 text-navy">{event.late_count} late</span>
        <span className="rounded-md bg-mist px-2 py-1 text-navy">{event.my_rsvp_status ? `You: ${event.my_rsvp_status}` : 'No RSVP yet'}</span>
      </div>
    </Link>
  );
}

function EventsLoading() {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4" aria-busy="true">
      <p className="text-sm font-semibold text-footballBlue">Loading events</p>
      <div className="mt-4 space-y-3">
        <div className="h-16 rounded-md bg-mist" />
        <div className="h-16 rounded-md bg-mist" />
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  error,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'date' | 'time' | 'datetime-local';
}) {
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      <input aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base" />
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
}: {
  label: string;
  value: string;
  options: readonly T[];
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)} className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-md bg-mist px-3 text-sm font-semibold text-navy">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-footballBlue" />
    </label>
  );
}
