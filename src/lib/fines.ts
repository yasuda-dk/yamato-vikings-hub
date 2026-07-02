export const finePaymentStatuses = ['Unpaid', 'Payment reported', 'Paid', 'Waived'] as const;

export type FinePaymentStatus = (typeof finePaymentStatuses)[number];

export type FineRecord = {
  id: string;
  participant_kind: 'member' | 'guest';
  participant_id: string;
  first_name: string;
  fine_type_name: string | null;
  description: string;
  amount_dkk: number;
  payment_status: FinePaymentStatus;
  related_event_title: string | null;
  related_event_date: string | null;
  created_at: string;
  payment_reported_at: string | null;
  payment_confirmed_at: string | null;
  waived_at: string | null;
};

export type FineParticipantOption = {
  kind: 'member' | 'guest';
  id: string;
  first_name: string;
  context: string | null;
};

export type FineBoxSettings = {
  mobilepay_box_number: string | null;
  mobilepay_url: string | null;
  payment_instructions: string | null;
};

export type FineBoxSummary = {
  unpaid_total_dkk: number;
  payment_reported_total_dkk: number;
  paid_total_dkk: number;
  waived_total_dkk: number;
};

export type FineBoxState = {
  settings: FineBoxSettings;
  summary: FineBoxSummary;
  fines: FineRecord[];
  participants: FineParticipantOption[];
};

export type ReportFinePaymentInput = {
  fineIds: string[];
};

export type CreateFineInput = {
  participantKind: 'member' | 'guest';
  participantId: string;
  description: string;
  amountDkk: number;
};

export type UpdateFineStatusInput = {
  fineId: string;
  action: 'confirm-paid' | 'waive';
};
