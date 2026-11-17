import { Component, type ReactNode } from 'react';

export class PageLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section className="rounded-lg border border-red-200 bg-white p-4" role="alert">
        <h2 className="text-xl font-bold text-navy">Could not open screen</h2>
        <p className="mt-2 text-sm text-navy/70">Check your connection and reload to try again.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white">
          Reload
        </button>
      </section>
    );
  }
}
