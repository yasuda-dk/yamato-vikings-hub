import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type {
  ActualStatus,
  EventCreateInput,
  EventDetail,
  EventDuplicateInput,
  EventGuestInput,
  EventParticipant,
  EventTeam,
  EventUpdateInput,
  EventVotingState,
  RsvpInput,
  RsvpStatus,
  VoteType,
  VotingCandidate,
} from '../lib/events';
import {
  actualStatuses,
  createDefaultGuestInput,
  eventRecordToInput,
  eventStatuses,
  eventTypes,
  formatEventDate,
  rsvpStatuses,
  validateDuplicateInput,
  validateEventGuestInput,
  validateEventInput,
  validateRsvpInput,
  voteTypes,
} from '../lib/events';
import { ageGroups, formatFootballLevel, footballLevelLabels, footballLevels, genders, positions, residenceTypes, type MemberProfile, type SecondaryPosition } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';

type EventDetailPageProps = {
  api: Phase1Api;
  selectedMember: MemberProfile;
};

export function EventDetailPage({ api, selectedMember }: EventDetailPageProps) {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [teams, setTeams] = useState<EventTeam[]>([]);
  const [voting, setVoting] = useState<EventVotingState | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [teamsLoadState, setTeamsLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [votingLoadState, setVotingLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [teamAttempt, setTeamAttempt] = useState(1);
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [teamNameDrafts, setTeamNameDrafts] = useState<Record<string, string>>({});
  const [swapSelection, setSwapSelection] = useState<{ teamId: string; participant: EventTeam['participants'][number] } | null>(null);
  const [voteDraft, setVoteDraft] = useState<Partial<Record<VoteType, string>>>({});
  const [awardOverrideDraft, setAwardOverrideDraft] = useState<Partial<Record<VoteType, string>>>({});
  const [guestDraft, setGuestDraft] = useState<EventGuestInput>(() => createDefaultGuestInput(eventId ?? ''));
  const [eventDraft, setEventDraft] = useState<EventCreateInput | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<EventDuplicateInput>({ eventId: eventId ?? '', eventDate: '' });
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);
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
    setDuplicateDraft((current) => ({ ...current, eventId }));
    setEventDraft(eventRecordToInput(detail.event));
  }, [detail, eventId]);

  useEffect(() => {
    setTeamNameDrafts((current) => {
      const nextDrafts: Record<string, string> = {};
      for (const team of teams) {
        nextDrafts[team.id] = current[team.id] ?? team.name;
      }
      return nextDrafts;
    });
  }, [teams]);

  useEffect(() => {
    if (!voting) return;
    setVoteDraft({
      MVP: voting.myVotes.MVP ? candidateKey(voting.myVotes.MVP.candidateKind, voting.myVotes.MVP.candidateId) : undefined,
      Worst: voting.myVotes.Worst ? candidateKey(voting.myVotes.Worst.candidateKind, voting.myVotes.Worst.candidateId) : undefined,
    });
  }, [voting]);

  useEffect(() => {
    if (!eventId) return;
    const currentEventId = eventId;
    let isMounted = true;

    async function loadDetail() {
      try {
        setLoadState('loading');
        setTeamsLoadState('loading');
        setVotingLoadState('loading');
        setError(null);
        const [nextDetail, nextTeams, nextVoting] = await Promise.all([api.getEventDetail(currentEventId), api.getEventTeams(currentEventId), api.getEventVoting(currentEventId)]);
        if (isMounted) {
          setDetail(nextDetail);
          setTeams(nextTeams);
          setVoting(nextVoting);
          setLoadState('ready');
          setTeamsLoadState('ready');
          setVotingLoadState('ready');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load event.');
          setLoadState('error');
          setTeamsLoadState('error');
          setVotingLoadState('error');
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
  const eventErrors = useMemo(() => (eventDraft ? validateEventInput(eventDraft) : {}), [eventDraft]);
  const duplicateError = useMemo(() => (detail ? validateDuplicateInput(duplicateDraft, detail.event.event_date) : null), [detail, duplicateDraft]);
  const saveDisabled = isSaving || Boolean(validationError) || loadState !== 'ready' || detail?.event.status === 'Cancelled';
  const isAdmin = selectedMember.application_role === 'Admin';
  const hasDraftTeams = teams.length > 0 && teams.every((team) => !team.is_confirmed);
  const canGenerateDraft = teams.length === 0 || hasDraftTeams;
  const hasUnlockedDraftParticipants = teams.some((team) => team.participants.some((participant) => !participant.is_locked));
  const assignedDraftParticipantCount = teams.reduce((count, team) => count + team.participants.length, 0);
  const isDraftComplete = detail ? assignedDraftParticipantCount === detail.counts.attended : false;

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
    const [nextDetail, nextTeams, nextVoting] = await Promise.all([api.getEventDetail(draft.eventId), api.getEventTeams(draft.eventId), api.getEventVoting(draft.eventId)]);
    setDetail(nextDetail);
    setTeams(nextTeams);
    setVoting(nextVoting);
    setSuccess(message);
  }

  async function handleGenerateTeams(teamCount: 2 | 3 | 4) {
    if (!detail || adminBusyId?.startsWith('generate-teams')) return;

    setAdminBusyId(`generate-teams-${teamCount}`);
    setTeamsLoadState('loading');
    setError(null);
    setSuccess(null);
    try {
      const nextTeams = await api.generateTeams({
        eventId: detail.event.id,
        teamCount,
        attemptNumber: teamAttempt,
      });
      setTeams(nextTeams);
      setTeamAttempt((current) => current + 1);
      setTeamsLoadState('ready');
      setSuccess('Draft teams generated.');
    } catch (teamError) {
      setTeamsLoadState('error');
      setError(teamError instanceof Error ? teamError.message : 'Could not generate teams.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function handleRegenerateUnlocked() {
    if (!detail || teams.length === 0 || adminBusyId === 'generate-unlocked') return;

    setAdminBusyId('generate-unlocked');
    setTeamsLoadState('loading');
    setError(null);
    setSuccess(null);
    try {
      const nextTeams = await api.generateTeams({
        eventId: detail.event.id,
        teamCount: teams.length as 2 | 3 | 4,
        attemptNumber: teamAttempt,
        preserveLocked: true,
      });
      setTeams(nextTeams);
      setTeamAttempt((current) => current + 1);
      setTeamsLoadState('ready');
      setSuccess('Unlocked players regenerated.');
    } catch (teamError) {
      setTeamsLoadState('error');
      setError(teamError instanceof Error ? teamError.message : 'Could not regenerate teams.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function adjustTeam(input: Parameters<Phase1Api['adjustTeam']>[0], message: string) {
    if (adminBusyId?.startsWith('team-action')) return;

    setAdminBusyId('team-action');
    setError(null);
    setSuccess(null);
    try {
      const nextTeams = await api.adjustTeam(input);
      setTeams(nextTeams);
      setSwapSelection(null);
      if (input.action === 'confirm-teams') {
        const [nextDetail, nextVoting] = await Promise.all([api.getEventDetail(input.eventId), api.getEventVoting(input.eventId)]);
        setDetail(nextDetail);
        setVoting(nextVoting);
      }
      setSuccess(message);
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : 'Could not update teams.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function handleMoveParticipant(team: EventTeam, participant: EventTeam['participants'][number], targetTeamId: string) {
    await adjustTeam(
      {
        action: 'move-participant',
        eventId: team.event_id,
        participantKind: participant.kind,
        participantId: participant.id,
        targetTeamId,
      },
      'Participant moved.',
    );
  }

  async function handleSwapParticipants(team: EventTeam, participant: EventTeam['participants'][number]) {
    if (!swapSelection) {
      setSwapSelection({ teamId: team.id, participant });
      setSuccess(`Selected ${participant.first_name} for swap.`);
      setError(null);
      return;
    }

    if (swapSelection.participant.kind === participant.kind && swapSelection.participant.id === participant.id) {
      setSwapSelection(null);
      setSuccess(null);
      return;
    }

    await adjustTeam(
      {
        action: 'swap-participants',
        eventId: team.event_id,
        participantKind: swapSelection.participant.kind,
        participantId: swapSelection.participant.id,
        swapParticipantKind: participant.kind,
        swapParticipantId: participant.id,
      },
      'Participants swapped.',
    );
  }

  async function handleToggleLock(team: EventTeam, participant: EventTeam['participants'][number]) {
    await adjustTeam(
      {
        action: 'toggle-lock',
        eventId: team.event_id,
        participantKind: participant.kind,
        participantId: participant.id,
        isLocked: !participant.is_locked,
      },
      participant.is_locked ? 'Participant unlocked.' : 'Participant locked.',
    );
  }

  async function handleRemoveParticipant(team: EventTeam, participant: EventTeam['participants'][number]) {
    await adjustTeam(
      {
        action: 'remove-participant',
        eventId: team.event_id,
        participantKind: participant.kind,
        participantId: participant.id,
      },
      'Participant removed from draft.',
    );
  }

  async function handleRenameTeam(team: EventTeam) {
    await adjustTeam(
      {
        action: 'rename-team',
        eventId: team.event_id,
        teamId: team.id,
        name: teamNameDrafts[team.id] ?? team.name,
      },
      'Team renamed.',
    );
  }

  async function handleConfirmTeams() {
    if (!detail) return;
    await adjustTeam({ action: 'confirm-teams', eventId: detail.event.id }, 'Teams confirmed.');
  }

  async function handleVotingStatus(status: 'Voting open' | 'Completed') {
    if (!detail || adminBusyId === 'voting-status') return;

    setAdminBusyId('voting-status');
    setVotingLoadState('loading');
    setError(null);
    setSuccess(null);
    try {
      const nextVoting = await api.setVotingStatus({ eventId: detail.event.id, status });
      const nextDetail = await api.getEventDetail(detail.event.id);
      setVoting(nextVoting);
      setDetail(nextDetail);
      setVotingLoadState('ready');
      setSuccess(status === 'Voting open' ? 'Voting opened.' : 'Voting closed.');
    } catch (votingError) {
      setVotingLoadState('error');
      setError(votingError instanceof Error ? votingError.message : 'Could not update voting.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function handleSubmitVotes() {
    if (!detail || isSaving) return;
    const mvp = parseCandidateKey(voteDraft.MVP);
    const worst = parseCandidateKey(voteDraft.Worst);
    if (!mvp || !worst) {
      setError('Choose one MVP and one Worst Player.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.submitVote({
        eventId: detail.event.id,
        voteType: 'MVP',
        candidateKind: mvp.kind,
        candidateId: mvp.id,
      });
      const nextVoting = await api.submitVote({
        eventId: detail.event.id,
        voteType: 'Worst',
        candidateKind: worst.kind,
        candidateId: worst.id,
      });
      setVoting(nextVoting);
      setSuccess('Votes submitted.');
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : 'Could not submit votes.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOverrideAward(awardType: VoteType) {
    if (!detail || adminBusyId === `override-${awardType}`) return;
    const candidate = parseCandidateKey(awardOverrideDraft[awardType]);
    if (!candidate) {
      setError(`Choose a ${awardType === 'MVP' ? 'MVP' : 'Worst Player'} override candidate.`);
      return;
    }

    setAdminBusyId(`override-${awardType}`);
    setVotingLoadState('loading');
    setError(null);
    setSuccess(null);
    try {
      const nextVoting = await api.overrideAward({
        eventId: detail.event.id,
        awardType,
        candidateKind: candidate.kind,
        candidateId: candidate.id,
      });
      setVoting(nextVoting);
      setVotingLoadState('ready');
      setSuccess(`${awardType === 'MVP' ? 'MVP' : 'Worst Player'} override saved.`);
    } catch (overrideError) {
      setVotingLoadState('error');
      setError(overrideError instanceof Error ? overrideError.message : 'Could not save award override.');
    } finally {
      setAdminBusyId(null);
    }
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

  async function handleUpdateEvent(event: FormEvent) {
    event.preventDefault();
    if (!eventDraft || Object.keys(eventErrors).length > 0 || adminBusyId === 'event-form') return;

    setAdminBusyId('event-form');
    setError(null);
    setSuccess(null);
    try {
      const input: EventUpdateInput = {
        ...eventDraft,
        eventId: draft.eventId,
        rsvpDeadline: new Date(eventDraft.rsvpDeadline).toISOString(),
      };
      await api.updateEvent(input);
      setShowEventForm(false);
      await refreshDetail('Event updated.');
    } catch (eventError) {
      setError(eventError instanceof Error ? eventError.message : 'Could not update event.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function handleDuplicateEvent(event: FormEvent) {
    event.preventDefault();
    if (duplicateError || adminBusyId === 'duplicate-form') return;

    setAdminBusyId('duplicate-form');
    setError(null);
    setSuccess(null);
    try {
      const newEventId = await api.duplicateEvent(duplicateDraft);
      navigate(`/events/${newEventId}`);
    } catch (duplicateEventError) {
      setError(duplicateEventError instanceof Error ? duplicateEventError.message : 'Could not duplicate event.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function handleCancelEvent() {
    if (!detail || adminBusyId === 'cancel-event') return;

    setAdminBusyId('cancel-event');
    setError(null);
    setSuccess(null);
    try {
      await api.updateEvent({
        ...eventRecordToInput(detail.event),
        eventId: detail.event.id,
        rsvpDeadline: detail.event.rsvp_deadline,
        status: 'Cancelled',
      });
      setShowEventForm(false);
      setShowDuplicateForm(false);
      await refreshDetail('Event cancelled.');
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel event.');
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

          {error ? (
            <p className="rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {success ? <p className="rounded-md border border-footballBlue/20 bg-white p-3 text-sm font-semibold text-footballBlue">{success}</p> : null}

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
                  <h3 className="mt-1 text-base font-bold text-navy">Event controls</h3>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowEventForm((current) => !current)} className="min-h-11 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue">
                  {showEventForm ? 'Close edit' : 'Edit event'}
                </button>
                <button type="button" onClick={() => setShowDuplicateForm((current) => !current)} className="min-h-11 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue">
                  {showDuplicateForm ? 'Close copy' : 'Duplicate'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleCancelEvent}
                disabled={detail.event.status === 'Cancelled' || adminBusyId === 'cancel-event'}
                className="mt-2 min-h-11 w-full rounded-md border border-red-200 bg-white px-3 text-sm font-bold text-red-700 disabled:border-navy/10 disabled:text-navy/45"
              >
                {detail.event.status === 'Cancelled' ? 'Event cancelled' : adminBusyId === 'cancel-event' ? 'Cancelling...' : 'Cancel event'}
              </button>

              {showEventForm && eventDraft ? (
                <form onSubmit={handleUpdateEvent} className="mt-4 space-y-4">
                  <h4 className="text-sm font-bold text-navy">Edit event</h4>
                  <EventFields draft={eventDraft} errors={eventErrors} onChange={setEventDraft} />
                  <button type="submit" disabled={Object.keys(eventErrors).length > 0 || adminBusyId === 'event-form'} className="min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
                    {adminBusyId === 'event-form' ? 'Saving...' : 'Save event'}
                  </button>
                </form>
              ) : null}

              {showDuplicateForm ? (
                <form onSubmit={handleDuplicateEvent} className="mt-4 space-y-4">
                  <h4 className="text-sm font-bold text-navy">Duplicate event</h4>
                  <TextInput label="New date" type="date" value={duplicateDraft.eventDate} error={duplicateError ?? undefined} onChange={(eventDate) => setDuplicateDraft((current) => ({ ...current, eventDate }))} />
                  <button type="submit" disabled={Boolean(duplicateError) || adminBusyId === 'duplicate-form'} className="min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
                    {adminBusyId === 'duplicate-form' ? 'Duplicating...' : 'Duplicate event'}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

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

          {isAdmin || teams.length > 0 ? (
            <div className="rounded-lg border border-navy/10 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-footballBlue">{isAdmin ? 'Admin' : 'Teams'}</p>
                  <h3 className="mt-1 text-base font-bold text-navy">Teams</h3>
                  <p className="mt-1 text-sm text-navy/70">{detail.counts.attended} attended participants available.</p>
                </div>
                <span className="shrink-0 rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{teams.some((team) => team.is_confirmed) ? 'Confirmed' : 'Draft'}</span>
              </div>

              {isAdmin && !detail.event.enable_team_generation ? <p className="mt-3 rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">Team generation is disabled for this event.</p> : null}

              {isAdmin && canGenerateDraft ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[2, 3, 4].map((teamCount) => (
                    <button
                      key={teamCount}
                      type="button"
                      disabled={!detail.event.enable_team_generation || detail.counts.attended < teamCount || adminBusyId === `generate-teams-${teamCount}`}
                      onClick={() => handleGenerateTeams(teamCount as 2 | 3 | 4)}
                      className="min-h-11 rounded-md bg-footballBlue px-2 text-sm font-bold text-white disabled:bg-navy/35"
                    >
                      {adminBusyId === `generate-teams-${teamCount}` ? '...' : `${teamCount} teams`}
                    </button>
                  ))}
                </div>
              ) : null}

              {isAdmin && hasDraftTeams ? (
                <button
                  type="button"
                  disabled={!hasUnlockedDraftParticipants || adminBusyId === 'generate-unlocked'}
                  onClick={handleRegenerateUnlocked}
                  className="mt-2 min-h-11 w-full rounded-md border border-footballBlue bg-white px-3 text-sm font-bold text-footballBlue disabled:border-navy/10 disabled:text-navy/40"
                >
                  {adminBusyId === 'generate-unlocked' ? 'Regenerating...' : 'Regenerate unlocked'}
                </button>
              ) : null}

              {isAdmin && detail.counts.attended < 2 ? <p className="mt-3 rounded-md bg-mist p-3 text-sm text-navy/70">Confirm at least two attendees before generating teams.</p> : null}
              {teamsLoadState === 'loading' ? <p className="mt-3 rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">Loading teams...</p> : null}
              {teamsLoadState === 'error' ? <p className="mt-3 rounded-md border border-red-200 p-3 text-sm font-semibold text-red-800">Teams could not load. Try again.</p> : null}
              {isAdmin && teamsLoadState === 'ready' && teams.length === 0 ? <p className="mt-3 rounded-md bg-mist p-3 text-sm text-navy/70">No draft teams yet.</p> : null}

              {teams.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {teams.map((team) => (
                    <TeamDraft
                      key={team.id}
                      team={team}
                      teams={teams}
                      isAdmin={isAdmin}
                      isBusy={adminBusyId === 'team-action'}
                      nameDraft={teamNameDrafts[team.id] ?? team.name}
                      onNameDraftChange={(name) => setTeamNameDrafts((current) => ({ ...current, [team.id]: name }))}
                      onRename={handleRenameTeam}
                      onMove={handleMoveParticipant}
                      onToggleLock={handleToggleLock}
                      onRemove={handleRemoveParticipant}
                      swapSelection={swapSelection}
                      onSwap={handleSwapParticipants}
                    />
                  ))}
                  {isAdmin && hasDraftTeams && swapSelection ? (
                    <button type="button" onClick={() => setSwapSelection(null)} className="min-h-11 w-full rounded-md border border-navy/15 bg-white px-3 text-sm font-bold text-navy">
                      Cancel swap
                    </button>
                  ) : null}
                </div>
              ) : null}

              {isAdmin && teams.length > 0 && hasDraftTeams ? (
                <>
                  {!isDraftComplete ? <p className="mt-3 rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">Draft teams must include every attended participant before confirmation.</p> : null}
                  <button type="button" disabled={adminBusyId === 'team-action' || !isDraftComplete} onClick={handleConfirmTeams} className="mt-4 min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
                    {adminBusyId === 'team-action' ? 'Saving...' : 'Confirm teams'}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {voting ? (
            <VotingPanel
              voting={voting}
              isAdmin={isAdmin}
              selectedMemberId={selectedMember.id}
              voteDraft={voteDraft}
              awardOverrideDraft={awardOverrideDraft}
              isSaving={isSaving}
              isBusy={adminBusyId === 'voting-status'}
              busyAwardType={adminBusyId?.startsWith('override-') ? (adminBusyId.replace('override-', '') as VoteType) : null}
              loadState={votingLoadState}
              onVoteDraftChange={setVoteDraft}
              onAwardOverrideDraftChange={setAwardOverrideDraft}
              onSubmitVotes={handleSubmitVotes}
              onOpenVoting={() => handleVotingStatus('Voting open')}
              onCloseVoting={() => handleVotingStatus('Completed')}
              onOverrideAward={handleOverrideAward}
            />
          ) : null}

          <form onSubmit={handleSubmit} className="rounded-lg border border-navy/10 bg-white p-4">
            <h3 className="text-base font-bold text-navy">Your RSVP</h3>
            {detail.myRsvp?.was_updated_after_deadline ? <p className="mt-2 text-sm font-semibold text-navy">Late response recorded</p> : null}

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

function candidateKey(kind: 'member' | 'guest', id: string) {
  return `${kind}:${id}`;
}

function parseCandidateKey(value: string | undefined): { kind: 'member' | 'guest'; id: string } | null {
  if (!value) return null;
  const [kind, id] = value.split(':');
  if ((kind !== 'member' && kind !== 'guest') || !id) return null;
  return { kind, id };
}

function VotingPanel({
  voting,
  isAdmin,
  selectedMemberId,
  voteDraft,
  awardOverrideDraft,
  isSaving,
  isBusy,
  busyAwardType,
  loadState,
  onVoteDraftChange,
  onAwardOverrideDraftChange,
  onSubmitVotes,
  onOpenVoting,
  onCloseVoting,
  onOverrideAward,
}: {
  voting: EventVotingState;
  isAdmin: boolean;
  selectedMemberId: string;
  voteDraft: Partial<Record<VoteType, string>>;
  awardOverrideDraft: Partial<Record<VoteType, string>>;
  isSaving: boolean;
  isBusy: boolean;
  busyAwardType: VoteType | null;
  loadState: 'idle' | 'loading' | 'ready' | 'error';
  onVoteDraftChange: (draft: Partial<Record<VoteType, string>>) => void;
  onAwardOverrideDraftChange: (draft: Partial<Record<VoteType, string>>) => void;
  onSubmitVotes: () => Promise<void>;
  onOpenVoting: () => Promise<void>;
  onCloseVoting: () => Promise<void>;
  onOverrideAward: (awardType: VoteType) => Promise<void>;
}) {
  const memberCandidates = voting.candidates.filter((candidate) => !(candidate.kind === 'member' && candidate.id === selectedMemberId));
  const canSubmit = voting.isEligibleVoter && Boolean(voteDraft.MVP) && Boolean(voteDraft.Worst) && !isSaving;
  const canOpen = isAdmin && voting.enableVoting && voting.status !== 'Voting open' && voting.status !== 'Completed' && voting.candidates.length > 0;
  const canClose = isAdmin && voting.status === 'Voting open';

  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-footballBlue">{isAdmin ? 'Admin' : 'Event'}</p>
          <h3 className="mt-1 text-base font-bold text-navy">Voting</h3>
          <p className="mt-1 text-sm text-navy/70">{voting.candidates.length} attended candidates.</p>
        </div>
        <span className="shrink-0 rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{voting.status === 'Voting open' ? 'Open' : voting.status === 'Completed' ? 'Final' : 'Closed'}</span>
      </div>

      {loadState === 'loading' ? <p className="mt-3 rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">Updating voting...</p> : null}
      {loadState === 'error' ? <p className="mt-3 rounded-md border border-red-200 p-3 text-sm font-semibold text-red-800">Voting could not update. Try again.</p> : null}
      {!voting.enableVoting ? <p className="mt-3 rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">Voting is disabled for this event.</p> : null}
      {voting.enableVoting && voting.candidates.length === 0 ? <p className="mt-3 rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">Confirm attendance before voting.</p> : null}

      {isAdmin && voting.enableVoting ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={!canOpen || isBusy} onClick={onOpenVoting} className="min-h-11 rounded-md bg-footballBlue px-3 text-sm font-bold text-white disabled:bg-navy/35">
            {isBusy && canOpen ? 'Opening...' : 'Open voting'}
          </button>
          <button type="button" disabled={!canClose || isBusy} onClick={onCloseVoting} className="min-h-11 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue disabled:border-navy/10 disabled:text-navy/40">
            {isBusy && canClose ? 'Closing...' : 'Close voting'}
          </button>
        </div>
      ) : null}

      {voting.status === 'Voting open' ? (
        <div className="mt-4 space-y-4">
          {voting.isEligibleVoter ? (
            <>
              {voteTypes.map((voteType) => (
                <VoteChoiceGroup
                  key={voteType}
                  voteType={voteType}
                  candidates={memberCandidates}
                  selectedKey={voteDraft[voteType]}
                  onSelect={(selectedKey) => onVoteDraftChange({ ...voteDraft, [voteType]: selectedKey })}
                />
              ))}
              <button type="button" disabled={!canSubmit} onClick={onSubmitVotes} className="min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
                {isSaving ? 'Submitting...' : 'Submit votes'}
              </button>
            </>
          ) : (
            <p className="rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">Only attended active members can vote.</p>
          )}
          <p className="rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">Intermediate results are hidden until voting closes.</p>
        </div>
      ) : null}

      {voting.status === 'Completed' ? (
        <div className="mt-4 space-y-3">
          {voting.results.length === 0 ? <p className="rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">No votes were submitted.</p> : null}
          {voteTypes.map((voteType) => {
            const results = voting.results.filter((result) => result.vote_type === voteType);
            if (results.length === 0) return null;
            return (
              <div key={voteType} className="rounded-md bg-mist p-3">
                <h4 className="text-sm font-bold text-navy">{voteType === 'MVP' ? 'MVP' : 'Worst Player'}</h4>
                <div className="mt-2 space-y-2">
                  {results.map((result) => (
                    <div key={`${result.vote_type}-${result.kind}-${result.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-navy">{result.first_name}</p>
                        {result.is_admin_override ? <p className="mt-1 text-xs font-bold text-footballBlue">Admin override</p> : null}
                      </div>
                      <span className="shrink-0 rounded bg-mist px-2 py-1 text-xs font-bold text-navy">
                        {result.vote_count} {result.vote_count === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  ))}
                </div>
                {isAdmin ? (
                  <AwardOverrideControl
                    awardType={voteType}
                    candidates={voting.candidates}
                    selectedKey={awardOverrideDraft[voteType]}
                    isBusy={busyAwardType === voteType}
                    disabled={loadState === 'loading'}
                    onSelect={(selectedKey) => onAwardOverrideDraftChange({ ...awardOverrideDraft, [voteType]: selectedKey })}
                    onOverride={() => onOverrideAward(voteType)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AwardOverrideControl({
  awardType,
  candidates,
  selectedKey,
  isBusy,
  disabled,
  onSelect,
  onOverride,
}: {
  awardType: VoteType;
  candidates: VotingCandidate[];
  selectedKey: string | undefined;
  isBusy: boolean;
  disabled: boolean;
  onSelect: (selectedKey: string) => void;
  onOverride: () => Promise<void>;
}) {
  const label = awardType === 'MVP' ? 'MVP' : 'Worst Player';

  return (
    <div className="mt-3 border-t border-navy/10 pt-3">
      <h5 className="text-xs font-bold uppercase text-navy/60">Override {label}</h5>
      <div className="mt-2 grid gap-2">
        {candidates.map((candidate) => {
          const key = candidateKey(candidate.kind, candidate.id);
          const isSelected = selectedKey === key;
          return (
            <button
              key={`${awardType}-override-${key}`}
              type="button"
              disabled={disabled || isBusy}
              onClick={() => onSelect(key)}
              className={`min-h-11 rounded-md border px-3 text-left text-sm font-bold disabled:border-navy/10 disabled:text-navy/40 ${isSelected ? 'border-footballBlue bg-white text-footballBlue' : 'border-navy/10 bg-white text-navy'}`}
            >
              {candidate.first_name}
              {candidate.kind === 'guest' ? <span className="ml-2 rounded bg-mist px-2 py-1 text-xs text-footballBlue">GUEST</span> : null}
            </button>
          );
        })}
      </div>
      <button type="button" disabled={disabled || isBusy || !selectedKey} onClick={onOverride} className="mt-2 min-h-11 w-full rounded-md border border-footballBlue bg-white px-3 text-sm font-bold text-footballBlue disabled:border-navy/10 disabled:text-navy/40">
        {isBusy ? 'Saving override...' : `Save ${label} override`}
      </button>
    </div>
  );
}

function VoteChoiceGroup({
  voteType,
  candidates,
  selectedKey,
  onSelect,
}: {
  voteType: VoteType;
  candidates: VotingCandidate[];
  selectedKey: string | undefined;
  onSelect: (selectedKey: string) => void;
}) {
  return (
    <div>
      <h4 className="text-sm font-bold text-navy">{voteType === 'MVP' ? 'MVP vote' : 'Worst Player vote'}</h4>
      <div className="mt-2 grid gap-2">
        {candidates.length === 0 ? <p className="rounded-md bg-mist p-3 text-sm font-semibold text-navy/70">No eligible candidates.</p> : null}
        {candidates.map((candidate) => {
          const key = candidateKey(candidate.kind, candidate.id);
          const isSelected = selectedKey === key;
          return (
            <button
              key={`${voteType}-${key}`}
              type="button"
              onClick={() => onSelect(key)}
              className={`min-h-11 rounded-md border px-3 text-left text-sm font-bold ${isSelected ? 'border-footballBlue bg-footballBlue text-white' : 'border-navy/10 bg-mist text-navy'}`}
            >
              {candidate.first_name}
              {candidate.kind === 'guest' ? <span className="ml-2 rounded bg-white/80 px-2 py-1 text-xs text-footballBlue">GUEST</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamDraft({
  team,
  teams,
  isAdmin,
  isBusy,
  nameDraft,
  onNameDraftChange,
  onRename,
  onMove,
  onToggleLock,
  onRemove,
  swapSelection,
  onSwap,
}: {
  team: EventTeam;
  teams: EventTeam[];
  isAdmin: boolean;
  isBusy: boolean;
  nameDraft: string;
  onNameDraftChange: (name: string) => void;
  onRename: (team: EventTeam) => Promise<void>;
  onMove: (team: EventTeam, participant: EventTeam['participants'][number], targetTeamId: string) => Promise<void>;
  onToggleLock: (team: EventTeam, participant: EventTeam['participants'][number]) => Promise<void>;
  onRemove: (team: EventTeam, participant: EventTeam['participants'][number]) => Promise<void>;
  swapSelection: { teamId: string; participant: EventTeam['participants'][number] } | null;
  onSwap: (team: EventTeam, participant: EventTeam['participants'][number]) => Promise<void>;
}) {
  const summary = summarizeTeam(team);
  const canEdit = isAdmin && !team.is_confirmed;

  return (
    <section className="rounded-md bg-mist p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-bold text-navy">{team.name}</h4>
          <p className="mt-1 text-xs font-semibold text-navy/65">
            {summary.playerCount} players · Level {summary.totalFootballLevel} total · Avg {summary.averageFootballLevel.toFixed(1)}
          </p>
        </div>
        <span className="shrink-0 rounded bg-white px-2 py-1 text-xs font-bold text-navy">
          FW {summary.positionCounts.FW} · MF {summary.positionCounts.MF} · DF {summary.positionCounts.DF}
        </span>
      </div>

      {canEdit ? (
        <div className="mt-3 grid gap-2">
          <label className="text-xs font-bold text-navy/65">
            Team name
            <input aria-label={`${team.name} name`} value={nameDraft} onChange={(event) => onNameDraftChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-navy/15 px-3 text-sm font-bold text-navy" />
          </label>
          <button type="button" disabled={isBusy || nameDraft.trim() === team.name || !nameDraft.trim()} onClick={() => onRename(team)} className="min-h-11 rounded-md border border-footballBlue bg-white px-3 text-sm font-bold text-footballBlue disabled:border-navy/10 disabled:text-navy/40">
            Save name
          </button>
        </div>
      ) : null}

      {team.participants.length === 0 ? <p className="mt-3 rounded bg-white px-3 py-2 text-sm text-navy/65">No players assigned.</p> : null}
      <div className="mt-3 space-y-2">
        {team.participants.map((participant) => (
          <div key={`${participant.kind}-${participant.id}`} className="rounded bg-white px-3 py-2">
            {swapSelection?.participant.kind === participant.kind && swapSelection.participant.id === participant.id ? <p className="mb-2 rounded bg-mist px-2 py-1 text-xs font-bold text-footballBlue">Selected for swap</p> : null}
            <div className="flex min-h-11 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-navy">{participant.first_name}</p>
                <p className="text-xs font-semibold text-navy/60">
                  {participant.primary_position} · Level {participant.football_level}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {participant.kind === 'guest' ? <span className="rounded bg-mist px-2 py-1 text-xs font-bold text-footballBlue">GUEST</span> : null}
                {participant.is_locked ? <span className="rounded bg-mist px-2 py-1 text-xs font-bold text-navy">Locked</span> : null}
              </div>
            </div>
            {canEdit ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" disabled={isBusy} onClick={() => onToggleLock(team, participant)} className="min-h-11 rounded-md bg-mist px-2 text-xs font-bold text-navy disabled:text-navy/40">
                  {participant.is_locked ? 'Unlock' : 'Lock'}
                </button>
                <button
                  type="button"
                  disabled={isBusy || participant.is_locked || (swapSelection !== null && swapSelection.participant.kind === participant.kind && swapSelection.participant.id === participant.id)}
                  onClick={() => onSwap(team, participant)}
                  className="min-h-11 rounded-md bg-mist px-2 text-xs font-bold text-navy disabled:text-navy/40"
                >
                  {swapSelection ? 'Swap with selected' : 'Select to swap'}
                </button>
                <button
                  type="button"
                  disabled={isBusy || participant.is_locked}
                  onClick={() => onRemove(team, participant)}
                  className="min-h-11 rounded-md border border-red-200 px-2 text-xs font-bold text-red-800 disabled:border-navy/10 disabled:text-navy/40"
                >
                  Remove from draft
                </button>
                {teams
                  .filter((targetTeam) => targetTeam.id !== team.id)
                  .map((targetTeam) => (
                    <button
                      key={targetTeam.id}
                      type="button"
                      disabled={isBusy || participant.is_locked}
                      onClick={() => onMove(team, participant, targetTeam.id)}
                      className="min-h-11 rounded-md border border-footballBlue px-2 text-xs font-bold text-footballBlue disabled:border-navy/10 disabled:text-navy/40"
                    >
                      Move to {targetTeam.name}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function summarizeTeam(team: EventTeam) {
  const totalFootballLevel = team.participants.reduce((sum, participant) => sum + participant.football_level, 0);
  return {
    playerCount: team.participants.length,
    totalFootballLevel,
    averageFootballLevel: team.participants.length ? totalFootballLevel / team.participants.length : 0,
    positionCounts: {
      FW: team.participants.filter((participant) => participant.primary_position === 'FW').length,
      MF: team.participants.filter((participant) => participant.primary_position === 'MF').length,
      DF: team.participants.filter((participant) => participant.primary_position === 'DF').length,
    },
  };
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

function EventFields({
  draft,
  errors,
  onChange,
}: {
  draft: EventCreateInput;
  errors: Partial<Record<keyof EventCreateInput, string>>;
  onChange: (draft: EventCreateInput) => void;
}) {
  return (
    <>
      <TextInput label="Title" value={draft.title} error={errors.title} onChange={(title) => onChange({ ...draft, title })} />
      <Select label="Event type" value={draft.eventType} options={eventTypes} onChange={(eventType) => onChange({ ...draft, eventType })} />
      <TextInput label="Date" type="date" value={draft.eventDate} error={errors.eventDate} onChange={(eventDate) => onChange({ ...draft, eventDate })} />
      <TextInput label="Start time" type="time" value={draft.startTime} error={errors.startTime} onChange={(startTime) => onChange({ ...draft, startTime })} />
      <TextInput label="Location" value={draft.location} error={errors.location} onChange={(location) => onChange({ ...draft, location })} />
      <TextInput label="RSVP deadline" type="datetime-local" value={draft.rsvpDeadline} error={errors.rsvpDeadline} onChange={(rsvpDeadline) => onChange({ ...draft, rsvpDeadline })} />
      <Select
        label="Number of teams"
        value={String(draft.numberOfTeams)}
        options={['2', '3', '4']}
        error={errors.numberOfTeams}
        onChange={(numberOfTeams) => onChange({ ...draft, numberOfTeams: Number(numberOfTeams) })}
      />
      <Select label="Status" value={draft.status} options={eventStatuses} onChange={(status) => onChange({ ...draft, status })} />
      <label className="block text-sm font-semibold text-navy">
        Notes
        <textarea value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} className="mt-2 min-h-24 w-full rounded-md border border-navy/20 px-3 py-2 text-base" />
      </label>
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-md bg-mist px-3 text-sm font-semibold text-navy">
        <span>Enable team generation</span>
        <input type="checkbox" checked={draft.enableTeamGeneration} onChange={(event) => onChange({ ...draft, enableTeamGeneration: event.target.checked })} className="h-5 w-5 accent-footballBlue" />
      </label>
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-md bg-mist px-3 text-sm font-semibold text-navy">
        <span>Enable voting</span>
        <input type="checkbox" checked={draft.enableVoting} onChange={(event) => onChange({ ...draft, enableVoting: event.target.checked })} className="h-5 w-5 accent-footballBlue" />
      </label>
    </>
  );
}

function rsvpButtonClass(isActive: boolean) {
  return ['min-h-11 rounded-md px-2 text-sm font-bold', isActive ? 'bg-footballBlue text-white' : 'bg-mist text-navy'].join(' ');
}

function actualStatusButtonClass(isActive: boolean) {
  return ['min-h-11 rounded-md px-1 text-xs font-bold', isActive ? 'bg-footballBlue text-white' : 'bg-white text-navy'].join(' ');
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
