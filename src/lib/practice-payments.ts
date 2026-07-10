export type PracticePaymentEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  location: string;
  payment_deadline_date: string;
};

export type PracticePaymentMember = {
  member_id: string;
  first_name: string;
  amount_dkk: number;
  payment_rule: 'Default' | 'Exempt' | 'Custom';
  is_exempt: boolean;
  rsvp_status: 'Going' | 'Maybe' | 'Not going' | null;
  is_paid: boolean;
  paid_at: string | null;
};

export type PracticePaymentState = {
  event: PracticePaymentEvent | null;
  myPayment: PracticePaymentMember | null;
  adminPayments: PracticePaymentMember[];
  totals: {
    expected_total_dkk: number;
    paid_total_dkk: number;
    unpaid_total_dkk: number;
    paid_count: number;
    unpaid_count: number;
    exempt_count: number;
  };
};
