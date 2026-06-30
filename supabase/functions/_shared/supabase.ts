import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

export function createUserClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase Edge Function environment is not configured');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization') ?? '',
      },
    },
    auth: {
      persistSession: false,
    },
  });
}

export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service environment is not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function requireUser(req: Request) {
  const supabase = createUserClient(req);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error('Authentication is required');
  }

  return { supabase, user: data.user };
}
