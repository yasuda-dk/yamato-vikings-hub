import { type FormEvent, useState } from 'react';

type AccessGateProps = {
  onSubmit: (password: string) => Promise<void>;
  error: string | null;
  isBusy: boolean;
};

export function AccessGate({ onSubmit, error, isBusy }: AccessGateProps) {
  const [password, setPassword] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(password);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-navy/10 bg-white p-4">
      <h2 className="text-xl font-bold text-navy">Enter team password</h2>
      <p className="mt-2 text-sm leading-5 text-navy/70">New devices need the shared Yamato Vikings password before opening team information.</p>
      <label className="mt-5 block text-sm font-semibold text-navy" htmlFor="team-password">
        Team password
      </label>
      <input
        id="team-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base outline-none focus:border-footballBlue focus:ring-2 focus:ring-footballBlue/20"
        autoComplete="current-password"
      />
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={isBusy}
        className="mt-5 min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-navy/40"
      >
        {isBusy ? 'Checking...' : 'Continue'}
      </button>
    </form>
  );
}
