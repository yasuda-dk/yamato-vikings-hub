export type SupabaseConfigStatus = {
  isConfigured: boolean;
  message: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function requireEnv(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function getSupabaseEnv() {
  return {
    url: requireEnv('VITE_SUPABASE_URL', supabaseUrl),
    publishableKey: requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY', publishableKey),
  };
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  try {
    getSupabaseEnv();
    return {
      isConfigured: true,
      message: 'Publishable client settings are present.',
    };
  } catch {
    return {
      isConfigured: false,
      message: 'Add local Supabase values in .env.local before connecting data.',
    };
  }
}
