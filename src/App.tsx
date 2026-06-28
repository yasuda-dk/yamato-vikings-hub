import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { CalendarDays, CircleDollarSign, Home, UsersRound } from './components/icons';
import { Page } from './components/Page';
import { getSupabaseConfigStatus } from './lib/env';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/fines', label: 'Fines', icon: CircleDollarSign },
  { to: '/members', label: 'Members', icon: UsersRound },
];

export function App() {
  const configStatus = getSupabaseConfigStatus();

  return (
    <HashRouter>
      <div className="min-h-dvh bg-field px-0 text-ink sm:px-6">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-line shadow-soft">
          <header className="border-b border-field/10 bg-white px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <p className="text-sm font-semibold uppercase tracking-wide text-turf">Yamato Vikings</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-field">Team Hub</h1>
            <p className="mt-2 text-sm leading-5 text-field/70">
              Mobile football operations will live here. Phase 0 keeps the shell ready for secure features.
            </p>
          </header>

          <main className="flex-1 px-4 py-4" data-testid="app-main">
            <Routes>
              <Route path="/" element={<Page title="Home" description="Team access, selected profile and next football activity will appear here." configStatus={configStatus} />} />
              <Route path="/events" element={<Page title="Events" description="Event lists, RSVP and attendance workflows begin in a later phase." configStatus={configStatus} />} />
              <Route path="/fines" element={<Page title="Fines" description="Fine Box totals and MobilePay actions will be added after voting and fines are implemented." configStatus={configStatus} />} />
              <Route path="/members" element={<Page title="Members" description="Member profiles and public team directory will be added after the access gate." configStatus={configStatus} />} />
              <Route path="/404" element={<Page title="Not found" description="This screen is not part of the mobile hub." configStatus={configStatus} />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </main>

          <nav
            aria-label="Primary"
            className="grid grid-cols-4 gap-1 border-t border-field/10 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
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
                      'focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2',
                      isActive ? 'bg-field text-white' : 'text-field/70',
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
