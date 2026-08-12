const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (typeof body.eventGuestId !== 'string') {
      return jsonResponse({ ok: false, error: 'Guest is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const authorization = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ ok: false, error: 'Supabase Edge Function environment is not configured' }, 500);
    }

    if (!authorization) {
      return jsonResponse({ ok: false, error: 'Authentication is required' }, 401);
    }

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_event_guest`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_event_guest_id: body.eventGuestId,
      }),
    });

    if (!rpcResponse.ok) {
      const errorBody = await rpcResponse.json().catch(() => null) as { message?: string; error?: string } | null;
      return jsonResponse({ ok: false, error: errorBody?.message ?? errorBody?.error ?? 'Could not remove guest.' }, 400);
    }

    const eventGuestId = await rpcResponse.json();
    return jsonResponse({ ok: true, eventGuestId });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
