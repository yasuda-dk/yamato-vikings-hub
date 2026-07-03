import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AccessGate } from './components/AccessGate';
import { EventDetailPage } from './components/EventDetailPage';
import { EventsPage } from './components/EventsPage';
import { FinesPage } from './components/FinesPage';
import { HomePage } from './components/HomePage';
import { CalendarDays, CircleDollarSign, Home, UsersRound } from './components/icons';
import { MembersPage } from './components/MembersPage';
import { Page } from './components/Page';
import { ProfileSetup } from './components/ProfileSetup';
import { getSupabaseConfigStatus } from './lib/env';
import { demoPhase1Api } from './lib/demo-phase1-api';
import { phase1Api, type Phase1Api, type SessionState } from './lib/phase1-api';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/fines', label: 'Fines', icon: CircleDollarSign },
  { to: '/members', label: 'Members', icon: UsersRound },
];

type AppProps = {
  api?: Phase1Api;
};

const initialState: SessionState = {
  hasAccess: false,
  selectedMember: null,
  members: [],
};

const defaultApi = import.meta.env.VITE_USE_DEMO_API === 'true' ? demoPhase1Api : phase1Api;

export function App({ api = defaultApi }: AppProps) {
  const configStatus = getSupabaseConfigStatus();
  const [sessionState, setSessionState] = useState<SessionState>(initialState);
  const [isBooting, setIsBooting] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const nextState = await api.getSessionState();
    setSessionState(nextState);
  }, [api]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        setError(null);
        await api.ensureAnonymousSession();
        const nextState = await api.getSessionState();
        if (isMounted) setSessionState(nextState);
      } catch (bootError) {
        if (isMounted) setError(bootError instanceof Error ? bootError.message : 'Could not start the app.');
      } finally {
        if (isMounted) setIsBooting(false);
      }
    }

    void boot();

    return () => {
      isMounted = false;
    };
  }, [api]);

  async function runAction(action: () => Promise<void>, successMessage?: string) {
    setIsBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await refreshState();
      if (successMessage) setSuccess(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Request failed.');
    } finally {
      setIsBusy(false);
    }
  }

  const selectedMember = sessionState.selectedMember;
  const appMode = isBooting ? 'loading' : !sessionState.hasAccess ? 'gate' : selectedMember ? 'ready' : 'profile';

  return (
    <HashRouter>
      <div className="min-h-dvh bg-mist px-0 text-navy sm:px-6">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-mist">
          <header className="border-b border-navy/10 bg-white px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}brand/yamato-vikings-logo.png`}
                alt="Yamato Vikings logo"
                className="h-14 w-14 shrink-0 rounded-md object-contain"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-wide text-footballBlue">Yamato Vikings</p>
                <h1 className="mt-1 text-2xl font-bold tracking-normal text-navy">Team Hub</h1>
              </div>
            </div>
            <p className="mt-3 text-sm leading-5 text-navy/70">
              {selectedMember ? `Submitting as ${selectedMember.first_name}` : 'Mobile access for team members and admins.'}
            </p>
          </header>

          <main className="flex-1 px-4 py-4" data-testid="app-main" data-app-mode={appMode}>
            {error && appMode !== 'gate' && appMode !== 'profile' ? (
              <div className="mb-4 rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
                {error}
              </div>
            ) : null}
            {success ? <div className="mb-4 rounded-md border border-footballBlue/20 bg-white p-3 text-sm font-semibold text-footballBlue">{success}</div> : null}
            {isBooting ? (
              <LoadingScreen />
            ) : !sessionState.hasAccess ? (
              <AccessGate onSubmit={(password) => runAction(() => api.verifyTeamPassword(password), 'Device approved.')} error={error} isBusy={isBusy} />
            ) : !selectedMember ? (
              <ProfileSetup
                members={sessionState.members}
                onSelectProfile={(memberId) => runAction(() => api.selectProfile(memberId), 'Profile selected.')}
                onRegister={(input) => runAction(() => api.registerMember(input), 'Profile created.')}
                isBusy={isBusy}
                error={error}
              />
            ) : (
              <Routes>
                <Route path="/" element={<HomePage api={api} members={sessionState.members} selectedMember={selectedMember} onSwitchProfile={() => setSessionState((current) => ({ ...current, selectedMember: null }))} />} />
                <Route path="/events" element={<EventsPage api={api} selectedMember={selectedMember} />} />
                <Route path="/events/:eventId" element={<EventDetailPage api={api} selectedMember={selectedMember} />} />
                <Route path="/fines" element={<FinesPage api={api} selectedMember={selectedMember} />} />
                <Route path="/members" element={<MembersPage members={sessionState.members} />} />
                <Route path="/404" element={<Page title="Not found" description="This screen is not part of the mobile hub." configStatus={configStatus} />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            )}
          </main>

          <nav
            aria-label="Primary"
            className="grid grid-cols-4 gap-1 border-t border-navy/10 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    [
                      'flex min-h-14 flex-col items-center justify-center rounded-md px-1 text-xs font-semibold',
                      'focus:outline-none focus:ring-2 focus:ring-footballBlue focus:ring-offset-2',
                      isActive ? 'bg-footballBlue text-white' : 'text-navy/70',
                    ].join(' ')
                  }
                >
                  <Icon aria-hidden="true" className="mb-1 h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </HashRouter>
  );
}

function LoadingScreen() {
  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4" aria-busy="true">
      <p className="text-sm font-semibold text-footballBlue">Loading</p>
      <h2 className="mt-2 text-xl font-bold text-navy">Opening Team Hub</h2>
      <div className="mt-5 space-y-3">
        <div className="h-11 rounded-md bg-mist" />
        <div className="h-11 rounded-md bg-mist" />
        <div className="h-12 rounded-md bg-mist" />
      </div>
    </section>
  );
}
