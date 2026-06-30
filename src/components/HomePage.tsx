import type { MemberProfile } from '../lib/member-options';

export function HomePage({ selectedMember, onSwitchProfile }: { selectedMember: MemberProfile; onSwitchProfile: () => void }) {
  return (
    <section className="rounded-lg border border-navy/10 bg-white p-4">
      <p className="text-sm font-semibold text-footballBlue">Submitting as {selectedMember.first_name}</p>
      <h2 className="mt-2 text-xl font-bold text-navy">Home</h2>
      <div className="mt-4 grid gap-3">
        <ProfileRow label="Age group" value={selectedMember.age_group} />
        <ProfileRow label="Football level" value={String(selectedMember.football_level)} />
        <ProfileRow label="Primary position" value={selectedMember.primary_position} />
        <ProfileRow label="Secondary position" value={selectedMember.secondary_position ?? 'None'} />
        <ProfileRow label="Residence type" value={selectedMember.residence_type} />
      </div>
      <button type="button" onClick={onSwitchProfile} className="mt-5 min-h-12 w-full rounded-md border border-navy/20 bg-white px-4 text-base font-bold text-navy">
        Switch profile
      </button>
    </section>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-mist px-3">
      <span className="text-sm text-navy/65">{label}</span>
      <span className="text-sm font-bold text-navy">{value}</span>
    </div>
  );
}
