import type { MemberProfile } from '../lib/member-options';
import { formatFootballLevel } from '../lib/member-options';

export function MembersPage({ members, selectedMember }: { members: MemberProfile[]; selectedMember: MemberProfile }) {
  const canViewFootballLevel = selectedMember.application_role === 'Admin';

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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
