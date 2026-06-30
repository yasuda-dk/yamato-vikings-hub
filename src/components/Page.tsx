import type { SupabaseConfigStatus } from '../lib/env';

type PageProps = {
  title: string;
  description: string;
  configStatus: SupabaseConfigStatus;
};

export function Page({ title, description, configStatus }: PageProps) {
  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-navy">{title}</h2>
        <span className="rounded-md bg-footballBlue/10 px-2 py-1 text-xs font-semibold text-footballBlue">Future</span>
      </div>
      <p className="mt-4 text-base leading-6 text-navy/75">{description}</p>
      <div className="mt-5 rounded-lg bg-mist p-3">
        <p className="text-sm font-semibold text-navy">Supabase configuration</p>
        <p className="mt-1 text-sm leading-5 text-navy/70">{configStatus.message}</p>
      </div>
    </section>
  );
}
