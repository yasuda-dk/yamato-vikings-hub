import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import type { ActualStatus, EventDetail, EventGuest, EventSummary, EventTeam, EventVotingState, RsvpInput, VoteInput, VotingResult } from './lib/events';
import type { FineBoxState } from './lib/fines';
import type { MemberProfile } from './lib/member-options';
import type { Phase1Api, SessionState } from './lib/phase1-api';
import type { PracticePaymentState } from './lib/practice-payments';

const takashi: MemberProfile = {
  id: 'member-1',
  first_name: 'Takashi',
  age_group: '35–39',
  football_level: 3,
  primary_position: 'MF',
  secondary_position: 'DF',
  residence_type: 'Local resident',
  gender: 'Male',
  practice_payment_rule: 'Default',
  practice_payment_custom_amount_dkk: null,
  membership_status: 'Active',
  application_role: 'Player',
  created_at: '2026-01-01T00:00:00.000Z',
};

const adminTakashi: MemberProfile = {
  ...takashi,
  application_role: 'Admin',
};

const genki: MemberProfile = {
  ...takashi,
  id: 'member-genki',
  first_name: 'Genki',
};

function createApi(initialState: SessionState): Phase1Api {
  let state = initialState;
  let event: EventSummary = {
    id: 'event-1',
    title: 'Friday Football',
    event_type: 'Football',
    event_date: '2026-07-16',
    start_time: '19:00:00',
    location: 'Yamato Pitch',
    rsvp_deadline: '2026-07-15T18:00:00.000Z',
    status: 'Open',
    my_rsvp_status: null,
    going_count: 8,
    maybe_count: 2,
    not_going_count: 1,
    late_count: 1,
  };
  let rsvp: EventDetail['myRsvp'] = null;
  let guest: EventGuest | null = null;
  let actualStatus: ActualStatus = 'Not confirmed';
  let teams: EventTeam[] = [];
  const votes: Record<string, VoteInput> = {};
  let awards: VotingResult[] = [];
  let practicePaidAt: string | null = null;
  let fineBox: FineBoxState = {
    settings: {
      mobilepay_box_number: '2391JB',
      mobilepay_url: 'https://qr.mobilepay.dk/box/703316ba-f36a-4335-9a16-f2ffbc1a02f8/pay-in',
      payment_instructions: 'Use your first name as the payment reference.',
    },
    summary: {
      unpaid_total_dkk: 20,
      payment_reported_total_dkk: 15,
      paid_total_dkk: 30,
      waived_total_dkk: 0,
    },
    fines: [
      {
        id: 'fine-1',
        participant_kind: 'member',
        participant_id: takashi.id,
        first_name: takashi.first_name,
        fine_type_name: 'Late arrival',
        description: 'Late arrival',
        amount_dkk: 20,
        payment_status: 'Unpaid',
        related_event_title: 'Friday Football',
        related_event_date: '2026-07-03',
        created_at: '2026-07-03T20:00:00.000Z',
        payment_reported_at: null,
        payment_confirmed_at: null,
        waived_at: null,
      },
      {
        id: 'fine-reported',
        participant_kind: 'member',
        participant_id: takashi.id,
        first_name: takashi.first_name,
        fine_type_name: null,
        description: 'Own goal',
        amount_dkk: 15,
        payment_status: 'Payment reported',
        related_event_title: 'Friday Football',
        related_event_date: '2026-07-03',
        created_at: '2026-07-03T20:10:00.000Z',
        payment_reported_at: '2026-07-04T08:00:00.000Z',
        payment_confirmed_at: null,
        waived_at: null,
      },
      {
        id: 'fine-2',
        participant_kind: 'member',
        participant_id: takashi.id,
        first_name: takashi.first_name,
        fine_type_name: 'Forgot equipment',
        description: 'Forgot bibs',
        amount_dkk: 30,
        payment_status: 'Paid',
        related_event_title: 'Friday Football',
        related_event_date: '2026-06-26',
        created_at: '2026-06-26T20:00:00.000Z',
        payment_reported_at: '2026-06-27T08:00:00.000Z',
        payment_confirmed_at: '2026-06-27T09:00:00.000Z',
        waived_at: null,
      },
    ],
    fineTypes: [
      {
        id: 'fine-type-late',
        name: 'Late arrival',
        default_amount_dkk: 20,
        is_active: true,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'fine-type-worst',
        name: 'Worst Player',
        default_amount_dkk: 50,
        is_active: true,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'fine-type-equipment',
        name: 'Forgot equipment',
        default_amount_dkk: 30,
        is_active: false,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
    ],
    participants: [
      {
        kind: 'member',
        id: takashi.id,
        first_name: takashi.first_name,
        context: null,
      },
      {
        kind: 'guest',
        id: 'guest-1',
        first_name: 'Ken',
        context: 'Friday Football',
      },
    ],
  };

  function buildVoting(): EventVotingState {
    const memberIsGoing = rsvp?.rsvp_status === 'Going' || actualStatus === 'Attended';
    const candidates = [
      ...(memberIsGoing
        ? [
            {
              kind: 'member' as const,
              id: takashi.id,
              first_name: takashi.first_name,
            },
          ]
        : []),
      ...(guest
        ? [
            {
              kind: 'guest' as const,
              id: guest.id,
              first_name: guest.first_name,
            },
          ]
        : []),
    ];
    const selectedMember = state.selectedMember;
    const myVotes: EventVotingState['myVotes'] = {};
    if (selectedMember) {
      for (const voteType of ['MVP', 'Worst'] as const) {
        const vote = votes[`${event.id}:${selectedMember.id}:${voteType}`];
        if (vote) myVotes[voteType] = { candidateKind: vote.candidateKind, candidateId: vote.candidateId };
      }
    }

    return {
      eventId: event.id,
      status: event.status,
      enableVoting: true,
      isEligibleVoter: Boolean(selectedMember && selectedMember.membership_status === 'Active' && memberIsGoing && event.status === 'Voting open'),
      candidates,
      myVotes,
      results:
        event.status === 'Completed'
          ? awards.filter((award) => award.is_admin_override || !awards.some((override) => override.vote_type === award.vote_type && override.is_admin_override))
          : [],
    };
  }

  function getPracticeAmount(member: MemberProfile) {
    if (member.practice_payment_rule === 'Exempt') return 0;
    if (member.practice_payment_rule === 'Custom') return member.practice_payment_custom_amount_dkk ?? 0;
    return member.age_group === 'Under 18' || member.residence_type === 'Student' ? 20 : 80;
  }

  function buildPracticePayment(): PracticePaymentState {
    const selectedMember = state.selectedMember;
    const canViewPracticeTracking = selectedMember?.application_role === 'Admin' || selectedMember?.first_name === 'Genki';
    const selectedRsvp = rsvp && selectedMember?.id === rsvp.member_id ? rsvp : null;
    const goingMembers = state.members.filter((member) => member.membership_status === 'Active' && rsvp?.member_id === member.id && rsvp.rsvp_status === 'Going');
    const adminPayments = goingMembers.map((member) => ({
      member_id: member.id,
      first_name: member.first_name,
      amount_dkk: getPracticeAmount(member),
      payment_rule: member.practice_payment_rule,
      is_exempt: member.practice_payment_rule === 'Exempt',
      rsvp_status: 'Going' as const,
      is_paid: Boolean(practicePaidAt && selectedMember?.id === member.id),
      paid_at: practicePaidAt && selectedMember?.id === member.id ? practicePaidAt : null,
    }));
    const expectedTotal = adminPayments.reduce((total, payment) => total + payment.amount_dkk, 0);
    const paidTotal = adminPayments.filter((payment) => payment.is_paid).reduce((total, payment) => total + payment.amount_dkk, 0);

    return {
      event: {
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        start_time: event.start_time,
        location: event.location,
        payment_deadline_date: '2026-07-17',
      },
      myPayment: selectedMember
        ? {
            member_id: selectedMember.id,
            first_name: selectedMember.first_name,
            amount_dkk: getPracticeAmount(selectedMember),
            payment_rule: selectedMember.practice_payment_rule,
            is_exempt: selectedMember.practice_payment_rule === 'Exempt',
            rsvp_status: selectedRsvp?.rsvp_status ?? null,
            is_paid: Boolean(practicePaidAt),
            paid_at: practicePaidAt,
          }
        : null,
      adminPayments: canViewPracticeTracking ? adminPayments : [],
      totals:
        canViewPracticeTracking
          ? {
              expected_total_dkk: expectedTotal,
              paid_total_dkk: paidTotal,
              unpaid_total_dkk: expectedTotal - paidTotal,
              paid_count: adminPayments.filter((payment) => payment.is_paid).length,
              unpaid_count: adminPayments.filter((payment) => !payment.is_paid && !payment.is_exempt).length,
              exempt_count: adminPayments.filter((payment) => payment.is_exempt).length,
            }
          : {
              expected_total_dkk: 0,
              paid_total_dkk: 0,
              unpaid_total_dkk: 0,
              paid_count: 0,
              unpaid_count: 0,
              exempt_count: 0,
            },
    };
  }

  return {
    ensureAnonymousSession: async () => null,
    getSessionState: async () => state,
    verifyTeamPassword: async (password) => {
      if (password !== 'demo') throw new Error('Incorrect team password');
      state = { ...state, hasAccess: true };
    },
    registerMember: async (input) => {
      const member = { ...takashi, id: 'member-new', first_name: input.firstName, gender: input.gender, practice_payment_rule: 'Default' as const, practice_payment_custom_amount_dkk: null };
      state = { hasAccess: true, selectedMember: member, members: [member] };
    },
    updateMember: async (input) => {
      if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
      const nextMembers = state.members.map((member) =>
        member.id === input.memberId
          ? {
              ...member,
              first_name: input.firstName,
              age_group: input.ageGroup,
              football_level: input.footballLevel,
              primary_position: input.primaryPosition,
              secondary_position: input.secondaryPosition === 'None' ? null : input.secondaryPosition,
              residence_type: input.residenceType,
              gender: input.gender,
              practice_payment_rule: input.practicePaymentRule,
              practice_payment_custom_amount_dkk: input.practicePaymentCustomAmountDkk,
              membership_status: input.membershipStatus,
              application_role: input.applicationRole,
            }
          : member,
      );
      state = {
        ...state,
        members: nextMembers,
        selectedMember: state.selectedMember ? nextMembers.find((member) => member.id === state.selectedMember?.id) ?? state.selectedMember : null,
      };
    },
    selectProfile: async (memberId, profilePassword) => {
      const selectedMember = state.members.find((member) => member.id === memberId) ?? null;
      if (selectedMember?.first_name === 'Takashi' && profilePassword !== 'demo-takashi') throw new Error('Incorrect Takashi password');
      state = { ...state, selectedMember };
    },
    listEvents: async () => [event],
    listAnalyticsEvents: async () => [event],
    getEventDetail: async () => ({
      event: {
        ...event,
        team_id: 'team-1',
        season_id: 'season-1',
        number_of_teams: 2,
        notes: 'Bring two shirts.',
        enable_team_generation: true,
        enable_voting: true,
        created_by: null,
        created_at: '2026-06-30T00:00:00.000Z',
        updated_at: '2026-06-30T00:00:00.000Z',
      },
      myRsvp: rsvp,
      counts: {
        going: event.going_count,
        maybe: event.maybe_count,
        notGoing: event.not_going_count,
        noResponse: 0,
        late: event.late_count,
        attended: (actualStatus === 'Attended' ? 1 : 0) + (guest?.actual_status === 'Attended' ? 1 : 0),
        guests: guest ? 1 : 0,
      },
      participants: [
        ...(rsvp
          ? [
              {
                kind: 'member' as const,
                id: takashi.id,
                first_name: takashi.first_name,
                rsvp_status: rsvp.rsvp_status,
                is_arriving_late: rsvp.is_arriving_late,
                expected_arrival_time: rsvp.expected_arrival_time,
                actual_status: actualStatus,
                football_level: takashi.football_level,
                primary_position: takashi.primary_position,
                secondary_position: takashi.secondary_position,
                age_group: takashi.age_group,
              },
            ]
          : []),
        ...(guest
          ? [
              {
                kind: 'guest' as const,
                id: guest.id,
                first_name: guest.first_name,
                rsvp_status: null,
                is_arriving_late: false,
                expected_arrival_time: null,
                actual_status: guest.actual_status,
                football_level: guest.football_level,
                primary_position: guest.primary_position,
                secondary_position: guest.secondary_position,
                age_group: guest.age_group,
              },
            ]
          : []),
      ],
      guests: guest ? [guest] : [],
    }),
    createEvent: async () => 'event-new',
    updateEvent: async (input) => {
      event = {
        ...event,
        title: input.title,
        event_type: input.eventType,
        event_date: input.eventDate,
        start_time: input.startTime,
        location: input.location,
        rsvp_deadline: input.rsvpDeadline,
        status: input.status,
      };
      return input.eventId;
    },
    duplicateEvent: async (input) => {
      if (input.eventDate === event.event_date) throw new Error('Choose a new date for the duplicated event');
      event = {
        ...event,
        id: 'event-copy',
        event_date: input.eventDate,
        my_rsvp_status: null,
        going_count: 0,
        maybe_count: 0,
        not_going_count: 0,
        late_count: 0,
      };
      return event.id;
    },
    updateRsvp: async (input: RsvpInput) => {
      event = { ...event, my_rsvp_status: input.rsvpStatus };
      rsvp = {
        id: 'attendance-1',
        event_id: input.eventId,
        member_id: state.selectedMember?.id ?? 'member-1',
        rsvp_status: input.rsvpStatus,
        is_arriving_late: input.rsvpStatus === 'Going' && input.isArrivingLate,
        expected_arrival_time: input.expectedArrivalTime || null,
        responded_at: '2026-06-30T00:00:00.000Z',
        updated_at: '2026-06-30T00:00:00.000Z',
        was_updated_after_deadline: false,
      };
    },
    createEventGuest: async (input) => {
      guest = {
        id: 'guest-1',
        event_id: input.eventId,
        first_name: input.firstName,
        first_name_normalized: input.firstName.toLowerCase(),
        age_group: input.ageGroup,
        football_level: input.footballLevel,
        primary_position: input.primaryPosition,
        secondary_position: input.secondaryPosition === 'None' ? null : input.secondaryPosition,
        residence_type: input.residenceType,
        gender: input.gender,
        actual_status: 'Not confirmed',
        created_by: null,
        created_at: '2026-06-30T00:00:00.000Z',
      };
      return guest.id;
    },
    updateAttendance: async (input) => {
      actualStatus = input.actualStatus;
    },
    updateGuestAttendance: async (input) => {
      if (guest?.id === input.eventGuestId) guest = { ...guest, actual_status: input.actualStatus };
    },
    getEventTeams: async () => teams,
    generateTeams: async (input) => {
      const lockedByKey = new Map<string, boolean>();
      const existingNames = teams.map((team) => team.name);
      if (input.preserveLocked) {
        teams.forEach((team) => {
          team.participants.forEach((participant) => {
            lockedByKey.set(`${participant.kind}:${participant.id}`, participant.is_locked);
          });
        });
      }

      teams = [
        {
          id: 'team-a',
          event_id: input.eventId,
          name: input.preserveLocked ? (existingNames[0] ?? 'Team A') : 'Team A',
          display_order: 0,
          is_confirmed: false,
          balance_score: 0,
          score_breakdown: {},
          participants: [
            {
              kind: 'member',
              id: takashi.id,
              first_name: takashi.first_name,
              football_level: takashi.football_level,
              primary_position: takashi.primary_position,
              secondary_position: takashi.secondary_position,
              age_group: takashi.age_group,
              is_locked: lockedByKey.get(`member:${takashi.id}`) === true,
            },
          ],
        },
        {
          id: 'team-b',
          event_id: input.eventId,
          name: input.preserveLocked ? (existingNames[1] ?? 'Team B') : 'Team B',
          display_order: 1,
          is_confirmed: false,
          balance_score: 0,
          score_breakdown: {},
          participants: guest
            ? [
                {
                  kind: 'guest',
                  id: guest.id,
                  first_name: guest.first_name,
                  football_level: guest.football_level,
                  primary_position: guest.primary_position,
                  secondary_position: guest.secondary_position,
                  age_group: guest.age_group,
                  is_locked: lockedByKey.get(`guest:${guest.id}`) === true,
                },
              ]
            : [],
        },
      ];
      return teams;
    },
    adjustTeam: async (input) => {
      if (input.action === 'rename-team') {
        teams = teams.map((team) => (team.id === input.teamId ? { ...team, name: input.name.trim() } : team));
      }

      if (input.action === 'toggle-lock') {
        teams = teams.map((team) => ({
          ...team,
          participants: team.participants.map((participant) =>
            participant.kind === input.participantKind && participant.id === input.participantId ? { ...participant, is_locked: input.isLocked } : participant,
          ),
        }));
      }

      if (input.action === 'move-participant') {
        const source = teams.find((team) => team.participants.some((participant) => participant.kind === input.participantKind && participant.id === input.participantId));
        const moved = source?.participants.find((participant) => participant.kind === input.participantKind && participant.id === input.participantId);
        if (!source || !moved) throw new Error('Draft participant not found');
        teams = teams.map((team) => {
          if (team.id === source.id) {
            return { ...team, participants: team.participants.filter((participant) => !(participant.kind === input.participantKind && participant.id === input.participantId)) };
          }
          if (team.id === input.targetTeamId) {
            return { ...team, participants: [...team.participants, moved] };
          }
          return team;
        });
      }

      if (input.action === 'remove-participant') {
        const source = teams.find((team) => team.participants.some((participant) => participant.kind === input.participantKind && participant.id === input.participantId));
        const removed = source?.participants.find((participant) => participant.kind === input.participantKind && participant.id === input.participantId);
        if (!source || !removed) throw new Error('Draft participant not found');
        teams = teams.map((team) => ({
          ...team,
          participants: team.participants.filter((participant) => !(participant.kind === input.participantKind && participant.id === input.participantId)),
        }));
      }

      if (input.action === 'swap-participants') {
        const source = teams.find((team) => team.participants.some((participant) => participant.kind === input.participantKind && participant.id === input.participantId));
        const target = teams.find((team) => team.participants.some((participant) => participant.kind === input.swapParticipantKind && participant.id === input.swapParticipantId));
        const first = source?.participants.find((participant) => participant.kind === input.participantKind && participant.id === input.participantId);
        const second = target?.participants.find((participant) => participant.kind === input.swapParticipantKind && participant.id === input.swapParticipantId);
        if (!source || !target || !first || !second) throw new Error('Draft participant not found');
        teams = teams.map((team) => {
          if (team.id === source.id) {
            return { ...team, participants: team.participants.map((participant) => (participant.kind === input.participantKind && participant.id === input.participantId ? second : participant)) };
          }
          if (team.id === target.id) {
            return { ...team, participants: team.participants.map((participant) => (participant.kind === input.swapParticipantKind && participant.id === input.swapParticipantId ? first : participant)) };
          }
          return team;
        });
      }

      if (input.action === 'confirm-teams') {
        teams = teams.map((team) => ({ ...team, is_confirmed: true }));
        event = { ...event, status: 'Teams confirmed' };
      }

      return teams;
    },
    getEventVoting: async () => buildVoting(),
    submitVote: async (input) => {
      const selectedMember = state.selectedMember;
      if (!selectedMember) throw new Error('Select a member profile before voting');
      if (input.candidateKind === 'member' && input.candidateId === selectedMember.id) throw new Error('You cannot vote for yourself');
      votes[`${input.eventId}:${selectedMember.id}:${input.voteType}`] = input;
      return buildVoting();
    },
    setVotingStatus: async (input) => {
      if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
      if (input.status === 'Voting open') {
        event = { ...event, status: 'Voting open' };
        awards = [];
        return buildVoting();
      }

      const voting = buildVoting();
      awards = ['MVP', 'Worst'].flatMap((voteType) => {
        const matchingVotes = Object.values(votes).filter((vote) => vote.eventId === input.eventId && vote.voteType === voteType);
        const counts = new Map<string, number>();
        matchingVotes.forEach((vote) => counts.set(`${vote.candidateKind}:${vote.candidateId}`, (counts.get(`${vote.candidateKind}:${vote.candidateId}`) ?? 0) + 1));
        const max = Math.max(0, ...counts.values());
        return [...counts]
          .filter(([, count]) => count === max && count > 0)
          .map(([key, vote_count]) => {
            const [kind, id] = key.split(':') as ['member' | 'guest', string];
            const candidate = voting.candidates.find((item) => item.kind === kind && item.id === id);
            if (!candidate) throw new Error('Candidate not found');
            return {
              ...candidate,
              vote_type: voteType as 'MVP' | 'Worst',
              vote_count,
              is_winner: true,
              is_admin_override: false,
            };
          });
      });
      event = { ...event, status: 'Completed' };
      return buildVoting();
    },
    overrideAward: async (input) => {
      if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
      if (event.status !== 'Completed') throw new Error('Awards can only be overridden after voting is completed');
      const voting = buildVoting();
      const candidate = voting.candidates.find((item) => item.kind === input.candidateKind && item.id === input.candidateId);
      if (!candidate) throw new Error('Candidate is not eligible');
      const vote_count = Object.values(votes).filter((vote) => vote.eventId === input.eventId && vote.voteType === input.awardType && vote.candidateKind === input.candidateKind && vote.candidateId === input.candidateId).length;
      awards = [
        ...awards.filter((award) => award.vote_type !== input.awardType || !award.is_admin_override),
        {
          ...candidate,
          vote_type: input.awardType,
          vote_count,
          is_winner: true,
          is_admin_override: true,
        },
      ];
      return buildVoting();
    },
    getFineBox: async () => fineBox,
    reportFinePayment: async (input) => {
      fineBox = {
        ...fineBox,
        summary: {
          ...fineBox.summary,
          unpaid_total_dkk: 0,
          payment_reported_total_dkk: 20,
        },
        fines: fineBox.fines.map((fine) =>
          input.fineIds.includes(fine.id)
            ? {
                ...fine,
                payment_status: 'Payment reported',
                payment_reported_at: '2026-07-04T08:00:00.000Z',
              }
            : fine,
        ),
      };
      return fineBox;
    },
    createFine: async (input) => {
      if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
      const participant = fineBox.participants.find((item) => item.kind === input.participantKind && item.id === input.participantId);
      if (!participant) throw new Error('Participant is required');
      const fineType = input.fineTypeId ? fineBox.fineTypes.find((item) => item.id === input.fineTypeId && item.is_active) : null;
      fineBox = {
        ...fineBox,
        summary: {
          ...fineBox.summary,
          unpaid_total_dkk: fineBox.summary.unpaid_total_dkk + input.amountDkk,
        },
        fines: [
          {
            id: 'fine-new',
            participant_kind: input.participantKind,
            participant_id: input.participantId,
            first_name: participant.first_name,
            fine_type_name: fineType?.name ?? null,
            description: input.description,
            amount_dkk: input.amountDkk,
            payment_status: 'Unpaid',
            related_event_title: participant.context,
            related_event_date: null,
            created_at: '2026-07-04T10:00:00.000Z',
            payment_reported_at: null,
            payment_confirmed_at: null,
            waived_at: null,
          },
          ...fineBox.fines,
        ],
      };
      return fineBox;
    },
    createFines: async (input) => {
      if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
      const fineType = input.fineTypeId ? fineBox.fineTypes.find((item) => item.id === input.fineTypeId && item.is_active) : null;
      const newFines = input.participants.map((selection, index) => {
        const participant = fineBox.participants.find((item) => item.kind === selection.kind && item.id === selection.id);
        if (!participant) throw new Error('Participant is required');

        return {
          id: `fine-new-${index}`,
          participant_kind: selection.kind,
          participant_id: selection.id,
          first_name: participant.first_name,
          fine_type_name: fineType?.name ?? null,
          description: input.description,
          amount_dkk: input.amountDkk,
          payment_status: 'Unpaid' as const,
          related_event_title: participant.context,
          related_event_date: null,
          created_at: '2026-07-04T10:00:00.000Z',
          payment_reported_at: null,
          payment_confirmed_at: null,
          waived_at: null,
        };
      });

      fineBox = {
        ...fineBox,
        summary: {
          ...fineBox.summary,
          unpaid_total_dkk: fineBox.summary.unpaid_total_dkk + input.amountDkk * input.participants.length,
        },
        fines: [...newFines, ...fineBox.fines],
      };
      return fineBox;
    },
    updateFineStatus: async (input) => {
      if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
      const fine = fineBox.fines.find((item) => item.id === input.fineId);
      if (!fine) throw new Error('Fine is required');
      fineBox = {
        ...fineBox,
        summary: {
          ...fineBox.summary,
          unpaid_total_dkk: fineBox.summary.unpaid_total_dkk - (input.action === 'waive' && fine.payment_status === 'Unpaid' ? fine.amount_dkk : 0),
          payment_reported_total_dkk: fineBox.summary.payment_reported_total_dkk - (fine.payment_status === 'Payment reported' ? fine.amount_dkk : 0),
          paid_total_dkk: fineBox.summary.paid_total_dkk + (input.action === 'confirm-paid' ? fine.amount_dkk : 0),
          waived_total_dkk: fineBox.summary.waived_total_dkk + (input.action === 'waive' ? fine.amount_dkk : 0),
        },
        fines: fineBox.fines.map((item) =>
          item.id === input.fineId
            ? {
                ...item,
                payment_status: input.action === 'confirm-paid' ? 'Paid' : 'Waived',
                payment_confirmed_at: input.action === 'confirm-paid' ? '2026-07-04T11:00:00.000Z' : item.payment_confirmed_at,
                waived_at: input.action === 'waive' ? '2026-07-04T11:00:00.000Z' : item.waived_at,
              }
            : item,
        ),
      };
      return fineBox;
    },
    createFineType: async (input) => {
      if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
      const name = input.name.trim().replace(/\s+/g, ' ');
      fineBox = {
        ...fineBox,
        fineTypes: [
          ...fineBox.fineTypes,
          {
            id: 'fine-type-new',
            name,
            default_amount_dkk: input.defaultAmountDkk,
            is_active: true,
            created_at: '2026-07-04T10:00:00.000Z',
            updated_at: '2026-07-04T10:00:00.000Z',
          },
        ],
      };
      return fineBox;
    },
    updateFineType: async (input) => {
      if (state.selectedMember?.application_role !== 'Admin') throw new Error('Admin permission is required');
      fineBox = {
        ...fineBox,
        fineTypes: fineBox.fineTypes.map((fineType) => (fineType.id === input.fineTypeId ? { ...fineType, is_active: input.isActive } : fineType)),
      };
      return fineBox;
    },
    getPracticePayment: async () => buildPracticePayment(),
    markPracticePaymentPaid: async (eventId) => {
      if (!state.selectedMember) throw new Error('Select a member profile before reporting payment');
      if (eventId !== event.id) throw new Error('Practice event not found');
      if (state.selectedMember.practice_payment_rule === 'Exempt') throw new Error('This member is exempt from Practice payment.');
      if (!rsvp || rsvp.member_id !== state.selectedMember.id || rsvp.rsvp_status !== 'Going') {
        throw new Error('Only Going members can mark practice payment paid.');
      }
      practicePaidAt = '2026-07-10T10:00:00.000Z';
      return buildPracticePayment();
    },
  };
}

describe('App shell', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  it('renders the team-password gate before device approval', async () => {
    render(<App api={createApi({ hasAccess: false, selectedMember: null, members: [] })} />);

    expect(screen.getByRole('heading', { name: 'Team Hub' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Enter team password' })).toBeInTheDocument();
  });

  it('loads all primary routes after profile selection', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /events/i }));
    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument();
    expect(screen.getByText(/RSVP Wed, Jul 15/)).toBeInTheDocument();
    expect(screen.getByText('2 maybe')).toBeInTheDocument();
    expect(screen.getByText('1 not going')).toBeInTheDocument();
    expect(screen.getByText('No RSVP yet')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /fines/i }));
    expect(screen.getByRole('heading', { name: 'Fines' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /members/i }));
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /home/i }));
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('requires the Takashi password before selecting Takashi', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: null, members: [takashi, genki] })} />);

    expect(await screen.findByRole('heading', { name: 'Choose profile' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Takashi' })).toBeInTheDocument();
    expect(screen.getByLabelText('Takashi password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open profile' })).toBeDisabled();

    await user.type(screen.getByLabelText('Takashi password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(await screen.findByText('Incorrect Takashi password')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Takashi password'));
    await user.type(screen.getByLabelText('Takashi password'), 'demo-takashi');
    await user.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(await screen.findByText('Profile selected.')).toBeInTheDocument();
    expect((await screen.findAllByText('Submitting as Takashi')).length).toBeGreaterThan(0);
  });

  it('shows an admin season overview on Home', async () => {
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);
    const expectMetricLabel = (label: string) => {
      expect(screen.getAllByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').trim() === label).length).toBeGreaterThanOrEqual(1);
    };

    expect(await screen.findByRole('heading', { name: 'Season overview' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    expectMetricLabel('Active members');
    expectMetricLabel('Average level');
    expectMetricLabel('Open events');
    expectMetricLabel('Going responses');
    expectMetricLabel('Late arrivals');
    expectMetricLabel('Fine records');
    expect(screen.getByRole('heading', { name: 'Fine totals' })).toBeInTheDocument();
    expect(screen.getByText('Payment reported')).toBeInTheDocument();
    expect(screen.getByText('15 DKK')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('30 DKK')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Events by type' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Events by status' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RSVP totals' })).toBeInTheDocument();
    expect(screen.getAllByText('Football').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Maybe').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Not going').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { name: 'Members by position' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Members by age group' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Members by residence' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Members by gender' })).toBeInTheDocument();
    expect(screen.getAllByText('MF').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('35–39').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Local resident').length).toBeGreaterThanOrEqual(1);
  });

  it('uses admin season events for Home analytics instead of the public upcoming event list', async () => {
    const api = createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] });
    api.listEvents = async () => [];
    api.listAnalyticsEvents = async () => [
      {
        id: 'past-event',
        title: 'Completed Practice',
        event_type: 'Football',
        event_date: '2026-01-08',
        start_time: '19:00:00',
        location: 'Hafnia Hallen',
        rsvp_deadline: '2026-01-07T18:00:00.000Z',
        status: 'Completed',
        my_rsvp_status: null,
        going_count: 10,
        maybe_count: 0,
        not_going_count: 1,
        late_count: 2,
      },
    ];

    render(<App api={api} />);

    expect(await screen.findByRole('heading', { name: 'Season overview' })).toBeInTheDocument();
    expect(await screen.findByText('Completed events')).toBeInTheDocument();
    expect(screen.getByText('Going responses')).toBeInTheDocument();
    expect(screen.getAllByText('Late arrivals').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show the admin season overview to players', async () => {
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Season overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
  });

  it('shows club contact details on Home without personal profile fields', async () => {
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('Genki +4521282316')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /instagram open yamato vikings/i })).toHaveAttribute(
      'href',
      'https://www.instagram.com/yamato_vikings?igsh=YTE0Y3J4enpubmNu&utm_source=qr',
    );
    expect(screen.queryByText('Age group')).not.toBeInTheDocument();
    expect(screen.queryByText('Primary position')).not.toBeInTheDocument();
    expect(screen.queryByText('Football level')).not.toBeInTheDocument();
  });

  it('lets a Going member mark the current practice payment paid from Home', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByRole('button', { name: 'Mark as paid' })).toBeDisabled();
    expect(screen.getByText('RSVP Going first')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));
    expect(await screen.findByText('RSVP updated.')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /home/i }));
    await user.click(await screen.findByRole('button', { name: 'Mark as paid' }));

    expect(await screen.findByText('Practice payment marked as paid.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paid' })).toBeDisabled();
  });

  it('shows Practice payment tracking to Genki without Admin role', async () => {
    const api = createApi({ hasAccess: true, selectedMember: genki, members: [genki] });
    await api.updateRsvp({ eventId: 'event-1', rsvpStatus: 'Going', isArrivingLate: false, expectedArrivalTime: '' });

    render(<App api={api} />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(await screen.findByText('Payment tracking')).toBeInTheDocument();
    expect(screen.getByText('0 paid · 1 not paid · 0 exempt')).toBeInTheDocument();
    expect(screen.getByText('Genki')).toBeInTheDocument();
    expect(screen.getAllByText('Not paid').length).toBeGreaterThanOrEqual(1);
  });

  it('uses the 20 kr practice price for students and under 18 members', async () => {
    const studentTakashi: MemberProfile = {
      ...takashi,
      residence_type: 'Student',
    };
    const under18Takashi: MemberProfile = {
      ...takashi,
      id: 'member-under-18',
      first_name: 'Junior',
      age_group: 'Under 18',
    };

    const { rerender } = render(<App api={createApi({ hasAccess: true, selectedMember: studentTakashi, members: [studentTakashi] })} />);
    expect(await screen.findByText('20 kr')).toBeInTheDocument();

    rerender(<App api={createApi({ hasAccess: true, selectedMember: under18Takashi, members: [under18Takashi] })} />);
    expect(await screen.findByText('20 kr')).toBeInTheDocument();
  });

  it('lets an admin edit a member football level', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /members/i }));
    expect(await screen.findByRole('heading', { name: 'Members' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit member' }));
    await user.selectOptions(screen.getByLabelText('Football level'), '4');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Member updated.')).toBeInTheDocument();
    expect(screen.getByText(/4 - High level/)).toBeInTheDocument();
  });

  it('lets an admin set a custom Practice payment amount', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /members/i }));
    await user.click(await screen.findByRole('button', { name: 'Edit member' }));

    await user.selectOptions(screen.getByLabelText('Payment rule'), 'Custom');
    await user.clear(screen.getByLabelText('Custom amount DKK'));
    await user.type(screen.getByLabelText('Custom amount DKK'), '35');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Member updated.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /home/i }));

    expect(await screen.findByText('35 kr')).toBeInTheDocument();
  });

  it('shows exempt Practice payment without a paid button', async () => {
    const exemptTakashi: MemberProfile = {
      ...takashi,
      practice_payment_rule: 'Exempt',
    };
    render(<App api={createApi({ hasAccess: true, selectedMember: exemptTakashi, members: [exemptTakashi] })} />);

    expect((await screen.findAllByText('Exempt')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('No Practice payment is required for this profile.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as paid' })).not.toBeInTheDocument();
  });

  it('lets a member select unpaid fines and report MobilePay payment', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    await user.click(await screen.findByRole('link', { name: /fines/i }));

    expect(await screen.findByText('Fine Box 2391JB')).toBeInTheDocument();
    expect(screen.getAllByText('20 DKK').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Pay with MobilePay' })).toHaveAttribute('href', 'https://qr.mobilepay.dk/box/703316ba-f36a-4335-9a16-f2ffbc1a02f8/pay-in');

    await user.click(screen.getByRole('button', { name: 'Select for payment' }));
    expect(screen.getByText('Amount due: 20 DKK')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'I have paid' }));

    expect(await screen.findByText('Payment reported. An Admin will confirm it after checking MobilePay.')).toBeInTheDocument();
    expect(screen.getByText('Reported')).toBeInTheDocument();
    expect(screen.getAllByText('Payment reported').length).toBeGreaterThan(0);
  });

  it('shows public fine details and payment history', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    await user.click(await screen.findByRole('link', { name: /fines/i }));
    await user.click(await screen.findAllByRole('button', { name: 'Show details' }).then((buttons) => buttons[0]));

    expect(screen.getByRole('heading', { name: 'Fine details' })).toBeInTheDocument();
    expect(screen.getByText('Participant')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText(/Friday Football ·/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(screen.queryByRole('heading', { name: 'Fine details' })).not.toBeInTheDocument();
  });

  it('filters fine history by payment status', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    await user.click(await screen.findByRole('link', { name: /fines/i }));

    expect(await screen.findByRole('heading', { name: 'Fine history' })).toBeInTheDocument();
    expect(screen.getByText('3 shown')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Paid' }));
    expect(screen.getByText('1 shown')).toBeInTheDocument();
    expect(screen.getByText('Forgot bibs')).toBeInTheDocument();
    expect(screen.queryByText('Late arrival')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Waived' }));
    expect(screen.getByRole('heading', { name: 'No waived fines' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('3 shown')).toBeInTheDocument();
  });

  it('lets an admin add, confirm and waive fines', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /fines/i }));
    await user.click(await screen.findByRole('button', { name: 'Add fine' }));
    await user.click(screen.getByRole('checkbox', { name: takashi.first_name }));
    await user.type(screen.getByLabelText('Description'), 'Yellow card');
    await user.clear(screen.getByLabelText('Amount DKK'));
    await user.type(screen.getByLabelText('Amount DKK'), '25');
    await user.click(screen.getByRole('button', { name: 'Add fine' }));

    expect(await screen.findByText('Fine added.')).toBeInTheDocument();
    expect(screen.getByText('Yellow card')).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole('button', { name: 'Confirm paid' });
    const enabledConfirmButton = confirmButtons.find((button) => !button.hasAttribute('disabled'));
    expect(enabledConfirmButton).toBeDefined();
    await user.click(enabledConfirmButton!);
    expect(await screen.findByText('Payment confirmed.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Waive' })[0]);
    expect(await screen.findByText('Fine waived.')).toBeInTheDocument();
    expect(screen.getAllByText('Waived').length).toBeGreaterThan(0);
  });

  it('lets an admin create, deactivate and use fine types', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /fines/i }));
    await user.click(await screen.findByRole('button', { name: 'New type' }));
    await user.type(screen.getByLabelText('Fine type name'), 'Yellow card');
    await user.clear(screen.getByLabelText('Default amount DKK'));
    await user.type(screen.getByLabelText('Default amount DKK'), '25');
    await user.click(screen.getByRole('button', { name: 'Create fine type' }));

    expect(await screen.findByText('Fine type created.')).toBeInTheDocument();
    expect(screen.getByText('Yellow card')).toBeInTheDocument();
    expect(screen.getByText('25 DKK · Active')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add fine' }));
    await user.click(screen.getByRole('checkbox', { name: takashi.first_name }));
    await user.selectOptions(screen.getByLabelText('Fine type'), 'fine-type-new');

    expect(screen.getByLabelText('Description')).toHaveValue('Yellow card');
    expect(screen.getByLabelText('Amount DKK')).toHaveValue(25);

    await user.click(screen.getByRole('button', { name: 'Add fine' }));
    expect(await screen.findByText('Fine added.')).toBeInTheDocument();
    expect(screen.getAllByText('Yellow card').length).toBeGreaterThan(0);

    const deactivateButtons = screen.getAllByRole('button', { name: 'Deactivate' });
    await user.click(deactivateButtons[deactivateButtons.length - 1]);
    expect(await screen.findByText('Fine type deactivated.')).toBeInTheDocument();
    expect(screen.getByText('25 DKK · Inactive')).toBeInTheDocument();
  });

  it('lets an admin add the same fine to multiple participants', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /fines/i }));
    await user.click(await screen.findByRole('button', { name: 'Add fine' }));
    await user.click(screen.getByRole('checkbox', { name: takashi.first_name }));
    await user.click(screen.getByRole('checkbox', { name: /Ken/i }));
    await user.selectOptions(screen.getByLabelText('Fine type'), 'fine-type-worst');

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Worst Player');
    expect(screen.getByLabelText('Amount DKK')).toHaveValue(50);

    await user.click(screen.getByRole('button', { name: 'Add 2 fines' }));

    expect(await screen.findByText('2 fines added.')).toBeInTheDocument();
    expect(screen.getAllByText('Worst Player').length).toBeGreaterThanOrEqual(3);
  });

  it('falls back for invalid routes after profile selection', async () => {
    window.location.hash = '#/missing';
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });

  it('fits a 320px mobile viewport without horizontal overflow', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByTestId('app-main')).toBeInTheDocument();
    expect(document.body.scrollWidth).toBeLessThanOrEqual(320);
  });

  it('keeps primary navigation fixed to the bottom of the viewport', async () => {
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    const nav = await screen.findByRole('navigation', { name: 'Primary' });

    expect(nav).toHaveClass('fixed');
    expect(nav).toHaveClass('bottom-0');
  });

  it('opens an event and updates RSVP with late arrival', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    expect(await screen.findByRole('heading', { name: 'Your RSVP' })).toBeInTheDocument();
    expect(screen.getByText('RSVP by')).toBeInTheDocument();
    expect(screen.getByText('Changes before the deadline are recorded as on time.')).toBeInTheDocument();

    await user.click(screen.getByLabelText('I’ll be late'));
    await user.type(screen.getByLabelText('Expected arrival time'), '1930');
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));

    expect(await screen.findByText('RSVP updated.')).toBeInTheDocument();
  });

  it('shows participant names grouped by RSVP status', async () => {
    const user = userEvent.setup();
    const api = createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] });
    const getEventDetail = api.getEventDetail;
    api.getEventDetail = async (eventId) => {
      const detail = await getEventDetail(eventId);
      return {
        ...detail,
        counts: {
          ...detail.counts,
          going: 2,
          maybe: 1,
          notGoing: 1,
          noResponse: 1,
          late: 1,
          guests: 1,
        },
        participants: [
          {
            kind: 'member',
            id: 'member-going',
            first_name: 'Genki',
            rsvp_status: 'Going',
            is_arriving_late: false,
            expected_arrival_time: null,
            actual_status: 'Not confirmed',
            football_level: 3,
            primary_position: 'MF',
            secondary_position: null,
            age_group: '30–34',
          },
          {
            kind: 'member',
            id: 'member-late',
            first_name: 'Takashi',
            rsvp_status: 'Going',
            is_arriving_late: true,
            expected_arrival_time: '19:30:00',
            actual_status: 'Not confirmed',
            football_level: 3,
            primary_position: 'MF',
            secondary_position: 'DF',
            age_group: '35–39',
          },
          {
            kind: 'member',
            id: 'member-maybe',
            first_name: 'Ken',
            rsvp_status: 'Maybe',
            is_arriving_late: false,
            expected_arrival_time: null,
            was_updated_after_deadline: true,
            actual_status: 'Not confirmed',
            football_level: 2,
            primary_position: 'DF',
            secondary_position: null,
            age_group: '25–29',
          },
          {
            kind: 'member',
            id: 'member-not-going',
            first_name: 'Yuki',
            rsvp_status: 'Not going',
            is_arriving_late: false,
            expected_arrival_time: null,
            actual_status: 'Absent',
            football_level: 4,
            primary_position: 'FW',
            secondary_position: null,
            age_group: '40–49',
          },
          {
            kind: 'member',
            id: 'member-no-response',
            first_name: 'Ryo',
            rsvp_status: null,
            is_arriving_late: false,
            expected_arrival_time: null,
            actual_status: 'Not confirmed',
            football_level: 3,
            primary_position: 'MF',
            secondary_position: null,
            age_group: 'Not specified',
          },
          {
            kind: 'guest',
            id: 'guest-1',
            first_name: 'Guest A',
            rsvp_status: null,
            is_arriving_late: false,
            expected_arrival_time: null,
            actual_status: 'Not confirmed',
            football_level: 3,
            primary_position: 'MF',
            secondary_position: null,
            age_group: 'Not specified',
          },
        ],
      };
    };

    render(<App api={api} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));

    expect(await screen.findByText('Genki')).toBeInTheDocument();
    expect(screen.getByText('Takashi · 19:30')).toBeInTheDocument();
    expect(screen.getByText('Ken · Late response')).toBeInTheDocument();
    expect(screen.getByText('Yuki')).toBeInTheDocument();
    expect(screen.getByText('Ryo')).toBeInTheDocument();
    expect(screen.getAllByText('No response').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Guest A · Guest')).toBeInTheDocument();
  });

  it('lets an admin add a guest for team generation', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    expect(await screen.findByRole('heading', { name: 'Guests' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.type(screen.getByLabelText('Guest first name'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));

    expect(await screen.findByText('Guest added.')).toBeInTheDocument();
    expect(screen.getByText('GUEST')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Attended' })).not.toBeInTheDocument();
  });

  it('lets an admin edit and duplicate an event', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(await screen.findByRole('button', { name: 'Edit event' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Sunday Football');
    await user.click(screen.getByRole('button', { name: 'Save event' }));

    expect(await screen.findByText('Event updated.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sunday Football' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    await user.type(screen.getByLabelText('New date'), '2026-07-10');
    await user.click(screen.getByRole('button', { name: 'Duplicate event' }));

    expect(await screen.findByRole('heading', { name: 'Sunday Football' })).toBeInTheDocument();
  });

  it('lets an admin cancel an event without deleting it', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(await screen.findByRole('button', { name: 'Cancel event' }));

    expect(await screen.findByText('Event cancelled.')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update RSVP' })).toBeDisabled();
  });

  it('lets an admin generate draft teams from Going members and guests', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.type(screen.getByLabelText('Guest first name'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));
    await screen.findByText('RSVP updated.');

    await user.click(screen.getByRole('button', { name: '2 teams' }));

    expect(await screen.findByText('Draft teams generated.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team B' })).toBeInTheDocument();
  });

  it('lets an admin rename, lock, move and confirm draft teams', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.type(screen.getByLabelText('Guest first name'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));
    await screen.findByText('RSVP updated.');
    await user.click(screen.getByRole('button', { name: '2 teams' }));
    await screen.findByText('Draft teams generated.');

    await user.clear(screen.getByLabelText('Team A name'));
    await user.type(screen.getByLabelText('Team A name'), 'Blue');
    await user.click(screen.getAllByRole('button', { name: 'Save name' })[0]);
    expect(await screen.findByText('Team renamed.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Blue' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Lock' })[0]);
    expect(await screen.findByText('Participant locked.')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Regenerate unlocked' }));
    expect(await screen.findByText('Unlocked players regenerated.')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText('Participant unlocked.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move to Team B' }));
    expect(await screen.findByText('Participant moved.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm teams' }));
    expect(await screen.findByText('Teams confirmed.')).toBeInTheDocument();
    expect(screen.getByText('Teams confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm teams' })).not.toBeInTheDocument();
  });

  it('lets an admin swap two unlocked draft participants', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.type(screen.getByLabelText('Guest first name'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));
    await screen.findByText('RSVP updated.');
    await user.click(screen.getByRole('button', { name: '2 teams' }));
    await screen.findByText('Draft teams generated.');

    await user.click(screen.getAllByRole('button', { name: 'Select to swap' })[0]);
    expect(await screen.findByText('Selected Takashi for swap.')).toBeInTheDocument();
    expect(screen.getByText('Selected for swap')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Swap with selected' })[1]);
    expect(await screen.findByText('Participants swapped.')).toBeInTheDocument();
    expect(screen.queryByText('Selected for swap')).not.toBeInTheDocument();
  });

  it('lets an admin remove an unlocked participant from draft teams', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] })} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.type(screen.getByLabelText('Guest first name'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));
    await screen.findByText('RSVP updated.');
    await user.click(screen.getByRole('button', { name: '2 teams' }));
    await screen.findByText('Draft teams generated.');

    await user.click(screen.getAllByRole('button', { name: 'Remove from draft' })[0]);

    expect(await screen.findByText('Participant removed from draft.')).toBeInTheDocument();
    expect(screen.getByText('No players assigned.')).toBeInTheDocument();
    expect(screen.getByText('2 team participants available.')).toBeInTheDocument();
    expect(screen.getByText('Draft teams must include every team participant before confirmation.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm teams' })).toBeDisabled();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('lets an eligible member vote and shows final results after close', async () => {
    const user = userEvent.setup();
    const api = createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] });
    render(<App api={api} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.type(screen.getByLabelText('Guest first name'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await api.updateAttendance({ eventId: 'event-1', memberId: adminTakashi.id, actualStatus: 'Attended' });
    await api.updateGuestAttendance({ eventGuestId: 'guest-1', actualStatus: 'Attended' });
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));
    await screen.findByText('RSVP updated.');

    await user.click(screen.getByRole('button', { name: 'Open voting' }));
    expect(await screen.findByText('Voting opened.')).toBeInTheDocument();
    expect(screen.getByText('Intermediate results are hidden until voting closes.')).toBeInTheDocument();

    const kenButtons = screen.getAllByRole('button', { name: /Ken/ });
    await user.click(kenButtons[0]);
    await user.click(kenButtons[1]);
    await user.click(screen.getByRole('button', { name: 'Submit votes' }));
    expect(await screen.findByText('Votes submitted.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close voting' }));
    expect(await screen.findByText('Voting closed.')).toBeInTheDocument();
    expect(screen.getByText('MVP')).toBeInTheDocument();
    expect(screen.getByText('Worst Player')).toBeInTheDocument();
    expect(screen.getAllByText('Ken').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 vote').length).toBeGreaterThanOrEqual(2);
  });

  it('lets an admin override a completed award result', async () => {
    const user = userEvent.setup();
    const api = createApi({ hasAccess: true, selectedMember: adminTakashi, members: [adminTakashi] });
    render(<App api={api} />);

    await user.click(await screen.findByRole('link', { name: /events/i }));
    await user.click(await screen.findByRole('link', { name: /Friday Football/i }));
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await user.type(screen.getByLabelText('Guest first name'), 'Ken');
    await user.click(screen.getByRole('button', { name: 'Add guest' }));
    await api.updateAttendance({ eventId: 'event-1', memberId: adminTakashi.id, actualStatus: 'Attended' });
    await api.updateGuestAttendance({ eventGuestId: 'guest-1', actualStatus: 'Attended' });
    await user.click(screen.getByRole('button', { name: 'Update RSVP' }));
    await screen.findByText('RSVP updated.');

    await user.click(screen.getByRole('button', { name: 'Open voting' }));
    const kenButtons = await screen.findAllByRole('button', { name: /Ken/ });
    await user.click(kenButtons[0]);
    await user.click(kenButtons[1]);
    await user.click(screen.getByRole('button', { name: 'Submit votes' }));
    await screen.findByText('Votes submitted.');
    await user.click(screen.getByRole('button', { name: 'Close voting' }));
    await screen.findByText('Voting closed.');

    await user.click(screen.getAllByRole('button', { name: 'Takashi' })[0]);
    await user.click(screen.getByRole('button', { name: 'Save MVP override' }));

    expect(await screen.findByText('MVP override saved.')).toBeInTheDocument();
    expect(screen.getByText('Admin override')).toBeInTheDocument();
    expect(screen.getAllByText('0 votes').length).toBeGreaterThanOrEqual(1);
  });

  it('creates a new member profile after password approval', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: false, selectedMember: null, members: [] })} />);

    await user.type(await screen.findByLabelText('Team password'), 'demo');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Choose profile' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('First name'), 'Takashi');
    expect(screen.queryByLabelText('Football level')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create profile' }));

    expect((await screen.findAllByText('Submitting as Takashi')).length).toBeGreaterThan(0);
    expect(screen.queryByText('3 - Decent')).not.toBeInTheDocument();
    expect(screen.queryByText('Football level')).not.toBeInTheDocument();
  });

  it('hides member football level from regular players', async () => {
    const user = userEvent.setup();
    render(<App api={createApi({ hasAccess: true, selectedMember: takashi, members: [takashi] })} />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByText('3 - Decent')).not.toBeInTheDocument();
    expect(screen.queryByText('Football level')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /members/i }));

    expect(await screen.findByRole('heading', { name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByText('3 - Decent')).not.toBeInTheDocument();
  });
});
