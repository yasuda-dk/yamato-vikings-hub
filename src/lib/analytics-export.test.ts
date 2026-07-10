import { describe, expect, it } from 'vitest';
import { buildSeasonOverviewCsv } from './analytics-export';
import type { EventSummary } from './events';
import type { FineBoxState } from './fines';
import type { MemberProfile } from './member-options';

const member: MemberProfile = {
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
  application_role: 'Admin',
  created_at: '2026-01-02T00:00:00Z',
};

const event: EventSummary = {
  id: 'event-1',
  title: 'Friday, Football',
  event_type: 'Football',
  event_date: '2026-07-03',
  start_time: '19:00',
  location: 'Yamato Arena',
  rsvp_deadline: '2026-07-02T19:00:00Z',
  status: 'Open',
  my_rsvp_status: 'Going',
  going_count: 8,
  maybe_count: 2,
  not_going_count: 1,
  late_count: 1,
};

const fineBox: FineBoxState = {
  settings: {
    mobilepay_box_number: '2391JB',
    mobilepay_url: 'https://example.com/mobilepay',
    payment_instructions: null,
  },
  summary: {
    unpaid_total_dkk: 70,
    payment_reported_total_dkk: 0,
    paid_total_dkk: 20,
    waived_total_dkk: 0,
  },
  fines: [
    {
      id: 'fine-1',
      participant_kind: 'member',
      participant_id: 'member-1',
      first_name: 'Takashi',
      fine_type_name: 'Late arrival',
      description: 'Late, train delay',
      amount_dkk: 20,
      payment_status: 'Unpaid',
      related_event_title: 'Friday, Football',
      related_event_date: '2026-07-03',
      created_at: '2026-07-03T20:00:00Z',
      payment_reported_at: null,
      payment_confirmed_at: null,
      waived_at: null,
    },
  ],
  participants: [],
  fineTypes: [],
};

describe('analytics CSV export', () => {
  it('builds one CSV with member, event and fine rows', () => {
    const csv = buildSeasonOverviewCsv({ seasonYear: 2026, members: [member], events: [event], fineBox });
    const lines = csv.split('\n');

    expect(lines[0]).toContain('season_year,record_type,first_name');
    expect(lines[1]).toBe('2026,member,Takashi,Active,Admin,35–39,Male,3,MF,DF,Local resident,,,,,,,,,,,,');
    expect(lines[2]).toBe('2026,event,,,,,,,,,,"Friday, Football",2026-07-03,Football,Open,8,2,1,1,,,,');
    expect(lines[3]).toBe('2026,fine,Takashi,,,,,,,,,"Friday, Football",2026-07-03,,,,,,,Late arrival,"Late, train delay",20,Unpaid');
  });
});
