import { type FormEvent, useMemo, useState } from 'react';
import {
  ageGroups,
  footballLevelLabels,
  footballLevels,
  formatFootballLevel,
  genders,
  positions,
  residenceTypes,
  validateAdminMemberUpdate,
  type AdminMemberUpdateInput,
  type MemberProfile,
  type SecondaryPosition,
} from '../lib/member-options';

type MembersPageProps = {
  members: MemberProfile[];
  selectedMember: MemberProfile;
  isBusy: boolean;
  onUpdateMember: (input: AdminMemberUpdateInput) => Promise<void>;
};

export function MembersPage({ members, selectedMember, isBusy, onUpdateMember }: MembersPageProps) {
  const canViewFootballLevel = selectedMember.application_role === 'Admin';
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4">
      <h2 className="text-xl font-bold text-navy">Members</h2>
      {members.length === 0 ? (
        <p className="mt-4 text-sm text-navy/70">No members yet.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {members.map((member) => (
            <article key={member.id} className="rounded-md bg-mist p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-navy">{member.first_name}</h3>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-navy">{member.membership_status}</span>
              </div>
              <p className="mt-2 text-sm text-navy/70">
                {canViewFootballLevel ? `${formatFootballLevel(member.football_level)} · ` : ''}
                {member.primary_position}
                {member.secondary_position ? ` / ${member.secondary_position}` : ''} · {member.age_group} · {member.gender}
              </p>
              {selectedMember.application_role === 'Admin' ? (
                <button
                  type="button"
                  onClick={() => setEditingMemberId((current) => (current === member.id ? null : member.id))}
                  className="mt-3 min-h-11 w-full rounded-md border border-navy/20 bg-white px-3 text-sm font-bold text-navy"
                >
                  {editingMemberId === member.id ? 'Close editor' : 'Edit member'}
                </button>
              ) : null}
              {editingMemberId === member.id ? (
                <MemberEditor
                  member={member}
                  members={members}
                  isBusy={isBusy}
                  onCancel={() => setEditingMemberId(null)}
                  onSubmit={async (input) => {
                    await onUpdateMember(input);
                    setEditingMemberId(null);
                  }}
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MemberEditor({
  member,
  members,
  isBusy,
  onCancel,
  onSubmit,
}: {
  member: MemberProfile;
  members: MemberProfile[];
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminMemberUpdateInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AdminMemberUpdateInput>(() => memberToDraft(member));
  const errors = useMemo(() => validateAdminMemberUpdate(draft, members), [draft, members]);
  const hasErrors = Object.keys(errors).length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateAdminMemberUpdate(draft, members);
    if (Object.keys(nextErrors).length > 0) return;
    await onSubmit(draft);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-md border border-navy/10 bg-white p-3">
      <TextInput label="First name" value={draft.firstName} error={errors.firstName} onChange={(firstName) => setDraft((current) => ({ ...current, firstName }))} />
      <Select label="Football level" value={String(draft.footballLevel)} options={footballLevels.map(String)} getOptionLabel={(level) => formatFootballLevel(Number(level) as keyof typeof footballLevelLabels)} onChange={(footballLevel) => setDraft((current) => ({ ...current, footballLevel: Number(footballLevel) as AdminMemberUpdateInput['footballLevel'] }))} error={errors.footballLevel} />
      <Select label="Age group" value={draft.ageGroup} options={ageGroups} onChange={(ageGroup) => setDraft((current) => ({ ...current, ageGroup }))} error={errors.ageGroup} />
      <Select label="Primary position" value={draft.primaryPosition} options={positions} onChange={(primaryPosition) => setDraft((current) => ({ ...current, primaryPosition }))} error={errors.primaryPosition} />
      <Select label="Secondary position" value={draft.secondaryPosition} options={['None', ...positions]} onChange={(secondaryPosition) => setDraft((current) => ({ ...current, secondaryPosition: secondaryPosition as SecondaryPosition }))} error={errors.secondaryPosition} />
      <Select label="Residence type" value={draft.residenceType} options={residenceTypes} onChange={(residenceType) => setDraft((current) => ({ ...current, residenceType }))} error={errors.residenceType} />
      <Select label="Gender" value={draft.gender} options={genders} onChange={(gender) => setDraft((current) => ({ ...current, gender }))} error={errors.gender} />
      <Select label="Member status" value={draft.membershipStatus} options={['Active', 'Inactive']} onChange={(membershipStatus) => setDraft((current) => ({ ...current, membershipStatus }))} error={errors.membershipStatus} />
      <Select label="Application role" value={draft.applicationRole} options={['Player', 'Admin']} onChange={(applicationRole) => setDraft((current) => ({ ...current, applicationRole }))} error={errors.applicationRole} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-md border border-navy/20 bg-white px-3 text-sm font-bold text-navy">
          Cancel
        </button>
        <button type="submit" disabled={isBusy || hasErrors} className="min-h-11 rounded-md bg-footballBlue px-3 text-sm font-bold text-white disabled:bg-navy/40">
          {isBusy ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function memberToDraft(member: MemberProfile): AdminMemberUpdateInput {
  return {
    memberId: member.id,
    firstName: member.first_name,
    ageGroup: member.age_group,
    footballLevel: member.football_level,
    primaryPosition: member.primary_position,
    secondaryPosition: member.secondary_position ?? 'None',
    residenceType: member.residence_type,
    gender: member.gender,
    membershipStatus: member.membership_status,
    applicationRole: member.application_role,
  };
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
