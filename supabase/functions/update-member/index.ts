import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const footballLevels = [1, 2, 3, 4, 5];
const membershipStatuses = ['Active', 'Inactive'];
const applicationRoles = ['Player', 'Admin'];
const practicePaymentRules = ['Default', 'Exempt', 'Custom'];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { supabase } = await requireUser(req);
    const body = await req.json();

    if (typeof body.teamId !== 'string') {
      return jsonResponse({ ok: false, error: 'Team is required' }, 400);
    }

    if (typeof body.memberId !== 'string') {
      return jsonResponse({ ok: false, error: 'Member is required' }, 400);
    }

    if (typeof body.firstName !== 'string' || body.firstName.trim().length === 0) {
      return jsonResponse({ ok: false, error: 'First name is required.' }, 400);
    }

    if (!footballLevels.includes(body.footballLevel)) {
      return jsonResponse({ ok: false, error: 'Select a football level.' }, 400);
    }

    if (!membershipStatuses.includes(body.membershipStatus)) {
      return jsonResponse({ ok: false, error: 'Select a member status.' }, 400);
    }

    if (!applicationRoles.includes(body.applicationRole)) {
      return jsonResponse({ ok: false, error: 'Select an application role.' }, 400);
    }

    if (!practicePaymentRules.includes(body.practicePaymentRule)) {
      return jsonResponse({ ok: false, error: 'Select a payment rule.' }, 400);
    }

    if (body.practicePaymentRule === 'Custom' && (!Number.isInteger(body.practicePaymentCustomAmountDkk) || body.practicePaymentCustomAmountDkk <= 0)) {
      return jsonResponse({ ok: false, error: 'Enter a custom amount above 0 DKK.' }, 400);
    }

    const { data, error } = await supabase.rpc('admin_update_member', {
      target_team_id: body.teamId,
      p_member_id: body.memberId,
      p_first_name: body.firstName,
      p_age_group: body.ageGroup,
      p_football_level: body.footballLevel,
      p_primary_position: body.primaryPosition,
      p_secondary_position: body.secondaryPosition === 'None' ? null : body.secondaryPosition,
      p_residence_type: body.residenceType,
      p_gender: body.gender,
      p_membership_status: body.membershipStatus,
      p_application_role: body.applicationRole,
      p_practice_payment_rule: body.practicePaymentRule,
      p_practice_payment_custom_amount_dkk: body.practicePaymentRule === 'Custom' ? body.practicePaymentCustomAmountDkk : null,
    });

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }

    return jsonResponse({ ok: true, memberId: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
