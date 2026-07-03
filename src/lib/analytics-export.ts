import type { EventSummary } from './events';
import type { FineBoxState } from './fines';
import type { MemberProfile } from './member-options';

const csvColumns = [
  'season_year',
  'record_type',
  'first_name',
  'membership_status',
  'application_role',
  'age_group',
  'gender',
  'football_level',
  'primary_position',
  'secondary_position',
  'residence_type',
  'event_title',
  'event_date',
  'event_type',
  'event_status',
  'going_count',
  'maybe_count',
  'not_going_count',
  'late_count',
  'fine_type',
  'fine_description',
  'amount_dkk',
  'payment_status',
] as const;

type CsvColumn = (typeof csvColumns)[number];
type CsvRow = Partial<Record<CsvColumn, string | number | null>>;

export type SeasonOverviewCsvInput = {
  seasonYear: number;
  members: MemberProfile[];
  events: EventSummary[];
  fineBox: FineBoxState;
};

export function buildSeasonOverviewCsv({ seasonYear, members, events, fineBox }: SeasonOverviewCsvInput) {
  const rows: CsvRow[] = [
    ...members.map((member) => ({
      season_year: seasonYear,
      record_type: 'member',
      first_name: member.first_name,
      membership_status: member.membership_status,
      application_role: member.application_role,
      age_group: member.age_group,
      gender: member.gender,
      football_level: member.football_level,
      primary_position: member.primary_position,
      secondary_position: member.secondary_position ?? 'None',
      residence_type: member.residence_type,
    })),
    ...events.map((event) => ({
      season_year: seasonYear,
      record_type: 'event',
      event_title: event.title,
      event_date: event.event_date,
      event_type: event.event_type,
      event_status: event.status,
      going_count: event.going_count,
      maybe_count: event.maybe_count,
      not_going_count: event.not_going_count,
      late_count: event.late_count,
    })),
    ...fineBox.fines.map((fine) => ({
      season_year: seasonYear,
      record_type: 'fine',
      first_name: fine.first_name,
      event_title: fine.related_event_title,
      event_date: fine.related_event_date,
      fine_type: fine.fine_type_name,
      fine_description: fine.description,
      amount_dkk: fine.amount_dkk,
      payment_status: fine.payment_status,
    })),
  ];

  return [csvColumns.join(','), ...rows.map(formatCsvRow)].join('\n');
}

export function downloadSeasonOverviewCsv(input: SeasonOverviewCsvInput) {
  const csv = buildSeasonOverviewCsv(input);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `yamato-vikings-season-${input.seasonYear}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatCsvRow(row: CsvRow) {
  return csvColumns.map((column) => escapeCsvValue(row[column])).join(',');
}

function escapeCsvValue(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
