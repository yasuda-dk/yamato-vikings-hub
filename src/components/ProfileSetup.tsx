import { type FormEvent, useMemo, useState } from 'react';
import {
  ageGroups,
  genders,
  positions,
  residenceTypes,
  validateRegistration,
  type MemberProfile,
  type MemberRegistrationInput,
  type SecondaryPosition,
} from '../lib/member-options';

type ProfileSetupProps = {
  members: MemberProfile[];
  onSelectProfile: (memberId: string, profilePassword?: string) => Promise<void>;
  onRegister: (input: MemberRegistrationInput) => Promise<void>;
  isBusy: boolean;
  error: string | null;
};

const defaultRegistration: MemberRegistrationInput = {
  firstName: '',
  ageGroup: 'Not specified',
  footballLevel: 3,
  primaryPosition: 'MF',
  secondaryPosition: 'None',
  residenceType: 'Not specified',
  gender: 'Not specified',
};

export function ProfileSetup({ members, onSelectProfile, onRegister, isBusy, error }: ProfileSetupProps) {
  const [mode, setMode] = useState<'select' | 'new'>(members.length > 0 ? 'select' : 'new');
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? '');
  const [profilePassword, setProfilePassword] = useState('');
  const [registration, setRegistration] = useState<MemberRegistrationInput>(defaultRegistration);
  const fieldErrors = useMemo(() => validateRegistration(registration, members), [registration, members]);
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const requiresProfilePassword = selectedMember?.first_name.trim().toLowerCase() === 'takashi';

  async function handleSelect(event: FormEvent) {
    event.preventDefault();
    if (selectedMemberId) await onSelectProfile(selectedMemberId, requiresProfilePassword ? profilePassword : undefined);
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    const errors = validateRegistration(registration, members);
    if (Object.keys(errors).length > 0) return;
    await onRegister(registration);
  }

  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4">
      <h2 className="text-xl font-bold text-navy">Choose profile</h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className={tabClass(mode === 'select')} onClick={() => setMode('select')} disabled={members.length === 0}>
          Existing
        </button>
        <button type="button" className={tabClass(mode === 'new')} onClick={() => setMode('new')}>
          I’m new
        </button>
      </div>

      {mode === 'select' ? (
        <form onSubmit={handleSelect} className="mt-5">
          <label className="block text-sm font-semibold text-navy" htmlFor="profile-select">
            Profile
          </label>
          <select
            id="profile-select"
            value={selectedMemberId}
            onChange={(event) => {
              setSelectedMemberId(event.target.value);
              setProfilePassword('');
            }}
            className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.first_name}
              </option>
            ))}
          </select>
          {requiresProfilePassword ? (
            <label className="mt-4 block text-sm font-semibold text-navy">
              Takashi password
              <input
                aria-label="Takashi password"
                type="password"
                value={profilePassword}
                onChange={(event) => setProfilePassword(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base"
                autoComplete="current-password"
              />
            </label>
          ) : null}
          {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <button type="submit" disabled={isBusy || !selectedMemberId || (requiresProfilePassword && !profilePassword)} className="mt-5 min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
            Open profile
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="mt-5 space-y-4">
          <TextInput label="First name" value={registration.firstName} error={fieldErrors.firstName} onChange={(firstName) => setRegistration((current) => ({ ...current, firstName }))} />
          <Select label="Age group" value={registration.ageGroup} options={ageGroups} onChange={(ageGroup) => setRegistration((current) => ({ ...current, ageGroup }))} />
          <Select label="Primary position" value={registration.primaryPosition} options={positions} onChange={(primaryPosition) => setRegistration((current) => ({ ...current, primaryPosition }))} />
          <Select
            label="Secondary position"
            value={registration.secondaryPosition}
            options={['None', ...positions]}
            onChange={(secondaryPosition) => setRegistration((current) => ({ ...current, secondaryPosition: secondaryPosition as SecondaryPosition }))}
            error={fieldErrors.secondaryPosition}
          />
          <Select label="Residence type" value={registration.residenceType} options={residenceTypes} onChange={(residenceType) => setRegistration((current) => ({ ...current, residenceType }))} />
          <Select label="Gender" value={registration.gender} options={genders} onChange={(gender) => setRegistration((current) => ({ ...current, gender }))} />
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          <button type="submit" disabled={isBusy || Object.keys(fieldErrors).length > 0} className="min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
            Create profile
          </button>
        </form>
      )}
    </section>
  );
}

function tabClass(isActive: boolean) {
  return ['min-h-11 rounded-md text-sm font-bold', isActive ? 'bg-footballBlue text-white' : 'bg-mist text-navy'].join(' ');
}

function TextInput({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base" />
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  getOptionLabel = (option) => option,
}: {
  label: string;
  value: string;
  options: readonly T[];
  onChange: (value: T) => void;
  error?: string;
  getOptionLabel?: (value: T) => string;
}) {
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)} className="mt-2 min-h-12 w-full rounded-md border border-navy/20 px-3 text-base">
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : null}
    </label>
  );
}
