import { FootballLoader } from './FootballLoader';

export function LoadingScreen({ title = 'Opening Team Hub' }: { title?: string }) {
  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4 text-center" aria-busy="true" role="status">
      <FootballLoader />
      <p className="mt-3 text-sm font-semibold text-footballBlue">Loading</p>
      <h2 className="mt-1 text-xl font-bold text-navy">{title}</h2>
    </section>
  );
}
