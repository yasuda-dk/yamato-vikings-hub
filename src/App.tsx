import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AccessGate } from './components/AccessGate';
import { AppHeader } from './components/AppHeader';
import { LoadingScreen } from './components/LoadingScreen';
import { CalendarDays, CircleDollarSign, Home, UsersRound } from './components/icons';
import { PageLoadBoundary } from './components/PageLoadBoundary';
import { Page } from './components/Page';
import { ProfileSetup } from './components/ProfileSetup';
import { getSupabaseConfigStatus } from './lib/env';
import { phase1Api, type Phase1Api, type SessionState } from './lib/phase1-api';

const loadHomePage = () => import('./components/HomePage').then((module) => ({ default: module.HomePage }));
const HomePage = lazy(loadHomePage);
const EventsPage = lazy(() => import('./components/EventsPage').then((module) => ({ default: module.EventsPage })));
const EventDetailPage = lazy(() => import('./components/EventDetailPage').then((module) => ({ default: module.EventDetailPage })));
const FinesPage = lazy(() => import('./components/FinesPage').then((module) => ({ default: module.FinesPage })));
const MembersPage = lazy(() => import('./components/MembersPage').then((module) => ({ default: module.MembersPage })));
const AnnualAwardsPage = lazy(() => import('./components/AnnualAwardsPage').then((module) => ({ default: module.AnnualAwardsPage })));
const AttendanceRankingPage = lazy(() => import('./components/AttendanceRankingPage').then((module) => ({ default: module.AttendanceRankingPage })));
const DemoApp = /* @__PURE__ */ lazy(async () => {
  const { demoPhase1Api } = await import('./lib/demo-phase1-api');
  return { default: () => <AppContent api={demoPhase1Api} /> };
});

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

export function App({ api }: AppProps) {
  if (!api && import.meta.env.VITE_USE_DEMO_API === 'true') {
    return <Suspense fallback={<LoadingScreen />}><DemoApp /></Suspense>;
  }
  return <AppContent api={api ?? phase1Api} />;
}

function AppContent({ api }: { api: Phase1Api }) {
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
        if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
          void loadHomePage().catch(() => undefined);
        }
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
          <AppHeader selectedMember={selectedMember} />

          <main className="flex-1 px-4 pb-24 pt-4" data-testid="app-main" data-app-mode={appMode}>
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
                onSelectProfile={(memberId, profilePassword) => runAction(() => api.selectProfile(memberId, profilePassword), 'Profile selected.')}
                onRegister={(input) => runAction(() => api.registerMember(input), 'Profile created.')}
                isBusy={isBusy}
                error={error}
              />
            ) : (
              <ScreenLoader>
                <Routes>
                  <Route path="/" element={<HomePage key={selectedMember.id} api={api} members={sessionState.members} selectedMember={selectedMember} onSwitchProfile={() => setSessionState((current) => ({ ...current, selectedMember: null }))} />} />
                  <Route path="/events" element={<EventsPage api={api} selectedMember={selectedMember} />} />
                  <Route path="/events/:eventId" element={<EventDetailPage api={api} selectedMember={selectedMember} />} />
                  <Route path="/fines" element={<FinesPage api={api} selectedMember={selectedMember} />} />
                  <Route path="/awards" element={<AnnualAwardsPage api={api} selectedMember={selectedMember} />} />
                  <Route path="/attendance-ranking" element={<AttendanceRankingPage api={api} memberId={selectedMember.id} />} />
                  <Route
                    path="/members"
                    element={<MembersPage members={sessionState.members} selectedMember={selectedMember} isBusy={isBusy} onUpdateMember={(input) => runAction(() => api.updateMember(input), 'Member updated.')} />}
                  />
                  <Route path="/404" element={<Page title="Not found" description="This screen is not part of the mobile hub." configStatus={configStatus} />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </ScreenLoader>
            )}
          </main>

          <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-20 mx-auto grid w-full max-w-[430px] grid-cols-4 gap-1 border-t border-navy/10 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
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

function ScreenLoader({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <PageLoadBoundary key={pathname}>
      <Suspense fallback={<LoadingScreen title="Opening screen" />}>{children}</Suspense>
    </PageLoadBoundary>
  );
}
