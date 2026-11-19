import { useLocation } from 'react-router-dom';
import type { MemberProfile } from '../lib/member-options';

export function AppHeader({ selectedMember }: { selectedMember: Pick<MemberProfile, 'first_name'> | null }) {
  const { pathname } = useLocation();
  const showBanner = Boolean(selectedMember && pathname === '/');

  if (showBanner) return (
    <header className="border-b border-navy/10 bg-white pt-[env(safe-area-inset-top)]">
      <div className="relative">
        <img
          src={`${import.meta.env.BASE_URL}brand/team-banner-860.webp`}
          srcSet={`${import.meta.env.BASE_URL}brand/team-banner-430.webp 430w, ${import.meta.env.BASE_URL}brand/team-banner-860.webp 860w`}
          sizes="(max-width: 430px) 100vw, 430px"
          alt="Yamato Vikings teammates together by the Copenhagen waterfront"
          width="860"
          height="645"
          fetchPriority="high"
          decoding="async"
          className="block aspect-[4/3] w-full object-contain"
        />
        <div data-testid="home-banner-brand" className="absolute inset-x-0 top-0 flex items-center gap-3 bg-black/60 px-3 py-2 text-white">
          <img src={`${import.meta.env.BASE_URL}brand/yamato-vikings-logo.png`} alt="Yamato Vikings logo" width="48" height="48" className="h-12 w-12 shrink-0 object-contain" />
          <div className="min-w-0 font-club uppercase">
            <h1 className="text-[28px] font-bold leading-none text-white">Yamato Vikings</h1>
            <p className="mt-1 text-base font-bold leading-4 text-white">Team Hub</p>
          </div>
        </div>
      </div>
      <p className="px-4 py-3 text-sm leading-5 text-navy/70">Submitting as {selectedMember?.first_name}</p>
    </header>
  );

  return (
    <header className="border-b border-navy/10 bg-white pt-[env(safe-area-inset-top)]">
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}brand/yamato-vikings-logo.png`} alt="Yamato Vikings logo" width="56" height="56" className="h-14 w-14 shrink-0 rounded-md object-contain" />
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-footballBlue">Yamato Vikings</p>
            <h1 className="mt-1 text-2xl font-bold text-navy">Team Hub</h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-5 text-navy/70">
          {selectedMember ? `Submitting as ${selectedMember.first_name}` : 'Mobile access for team members and admins.'}
        </p>
      </div>
    </header>
  );
}
