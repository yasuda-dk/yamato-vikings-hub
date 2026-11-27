import { practicePaymentRequest } from './practice-payment-state.ts';
Deno.test('personal unpaid routing trusts the selected server profile, not a client member ID', () => {
  const request = practicePaymentRequest({ teamId: 'team', section: 'my-unpaid', memberId: 'someone-else', canTrackPayments: true });
  if (request.rpc !== 'get_my_unpaid_practices' || request.field !== 'unpaidPractices' || Object.keys(request.args).length !== 1) throw new Error('Unsafe unpaid routing');
});
Deno.test('current and tracking history requests retain their existing contracts', () => {
  const current = practicePaymentRequest({ teamId: 'team', section: 'current' });
  if (current.rpc !== 'get_practice_payment_state' || !('include_history' in current.args) || current.args.include_history !== false) throw new Error('Current request changed');
  if (practicePaymentRequest({ teamId: 'team', section: 'history' }).field !== 'practiceHistory') throw new Error('Tracking request changed');
  const legacy = practicePaymentRequest({ teamId: 'team' });
  if ('include_history' in legacy.args) throw new Error('Legacy request changed');
});
