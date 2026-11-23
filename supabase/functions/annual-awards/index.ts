import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
import { awardRequest } from '../_shared/annual-awards.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'POST is required' }, 405);
  try {
    const { supabase } = await requireUser(req);
    const plan = awardRequest(await req.json());
    const { data, error } = await supabase.rpc(plan.rpc, plan.args);
    if (error) return jsonResponse({ ok: false, error: error.message }, 400);
    return jsonResponse({ ok: true, [plan.field]: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Could not process annual awards' }, 400);
  }
});
