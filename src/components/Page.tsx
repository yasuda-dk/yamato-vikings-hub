import type { SupabaseConfigStatus } from '../lib/env';

type PageProps = {
  title: string;
  description: string;
  configStatus: SupabaseConfigStatus;
};

export function Page({ title, description, configStatus }: PageProps) {
  return (
    <section className="rounded-lg border border-field/10 bg-white p-4">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-field">{title}</h2>
        <span className="rounded-md bg-gold/25 px-2 py-1 text-xs font-semibold text-field">Phase 0</span>
      </div>
      <p className="mt-4 text-base leading-6 text-field/75">{description}</p>
      <div className="mt-5 rounded-lg bg-line p-3">
        <p className="text-sm font-semibold text-field">Supabase configuration</p>
        <p className="mt-1 text-sm leading-5 text-field/70">{configStatus.message}</p>
      </div>
    </section>
  );
}
