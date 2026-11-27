export function practicePaymentRequest(body: Record<string, unknown>) {
  if (typeof body.teamId !== 'string') throw new Error('Team is required');
  const args = { target_team_id: body.teamId };
  if (body.section === 'my-unpaid') return { rpc: 'get_my_unpaid_practices', args, field: 'unpaidPractices' };
  if (body.section === 'history') return { rpc: 'get_practice_payment_history', args, field: 'practiceHistory' };
  return { rpc: 'get_practice_payment_state', args: { ...args, ...(body.section === 'current' ? { include_history: false } : {}) }, field: 'practicePayment' };
}
