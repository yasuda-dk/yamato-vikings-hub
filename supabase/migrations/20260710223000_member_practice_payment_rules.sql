do $$
begin
  if not exists (select 1 from pg_type where typname = 'practice_payment_rule_type') then
    create type public.practice_payment_rule_type as enum ('Default', 'Exempt', 'Custom');
  end if;
end $$;

alter table public.members
  add column if not exists practice_payment_rule public.practice_payment_rule_type not null default 'Default',
  add column if not exists practice_payment_custom_amount_dkk integer;

alter table public.members
  drop constraint if exists members_practice_payment_custom_amount_valid;

alter table public.members
  add constraint members_practice_payment_custom_amount_valid
  check (
    (
      practice_payment_rule = 'Custom'
      and practice_payment_custom_amount_dkk is not null
      and practice_payment_custom_amount_dkk > 0
    )
    or (
      practice_payment_rule <> 'Custom'
      and practice_payment_custom_amount_dkk is null
    )
  );

drop policy if exists "Members can update their editable profile fields" on public.members;
create policy "Members can update their editable profile fields"
on public.members for update
using (id = public.current_member_id())
with check (
  id = public.current_member_id()
  and first_name = (select first_name from public.members existing where existing.id = members.id)
  and football_level = (select football_level from public.members existing where existing.id = members.id)
  and membership_status = (select membership_status from public.members existing where existing.id = members.id)
  and application_role = (select application_role from public.members existing where existing.id = members.id)
  and practice_payment_rule = (select practice_payment_rule from public.members existing where existing.id = members.id)
  and practice_payment_custom_amount_dkk is not distinct from (select practice_payment_custom_amount_dkk from public.members existing where existing.id = members.id)
);

create or replace function public.admin_update_member(
  target_team_id uuid,
  p_member_id uuid,
  p_first_name text,
  p_age_group public.age_group,
  p_football_level integer,
  p_primary_position public.position_code,
  p_secondary_position public.position_code,
  p_residence_type public.residence_type,
  p_gender public.gender_type,
  p_membership_status public.membership_status,
  p_application_role public.application_role,
  p_practice_payment_rule public.practice_payment_rule_type,
  p_practice_payment_custom_amount_dkk integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  active_member_id uuid := public.current_member_id();
  normalized_name text;
  previous_member public.members%rowtype;
  active_admin_count integer;
begin
  if not public.is_admin(target_team_id) then
    raise exception 'Admin permission is required';
  end if;

  select * into previous_member
  from public.members
  where id = p_member_id
    and team_id = target_team_id;

  if previous_member.id is null then
    raise exception 'Member not found';
  end if;

  normalized_name := public.normalize_first_name(p_first_name);

  if length(normalized_name) = 0 then
    raise exception 'First name is required.';
  end if;

  if p_football_level is null or p_football_level < 1 or p_football_level > 5 then
    raise exception 'Select a football level.';
  end if;

  if p_practice_payment_rule is null then
    raise exception 'Select a payment rule.';
  end if;

  if p_practice_payment_rule = 'Custom' and (p_practice_payment_custom_amount_dkk is null or p_practice_payment_custom_amount_dkk <= 0) then
    raise exception 'Enter a custom amount above 0 DKK.';
  end if;

  if p_practice_payment_rule <> 'Custom' then
    p_practice_payment_custom_amount_dkk := null;
  end if;

  select count(*) into active_admin_count
  from public.members
  where team_id = target_team_id
    and application_role = 'Admin'
    and membership_status = 'Active';

  if p_member_id = active_member_id
    and previous_member.application_role = 'Admin'
    and previous_member.membership_status = 'Active'
    and active_admin_count <= 1
    and (p_application_role <> 'Admin' or p_membership_status <> 'Active')
  then
    raise exception 'The final active Admin cannot remove their own Admin access.';
  end if;

  update public.members
  set
    first_name = btrim(regexp_replace(p_first_name, '\s+', ' ', 'g')),
    first_name_normalized = normalized_name,
    age_group = p_age_group,
    football_level = p_football_level,
    primary_position = p_primary_position,
    secondary_position = p_secondary_position,
    residence_type = p_residence_type,
    gender = p_gender,
    membership_status = p_membership_status,
    application_role = p_application_role,
    practice_payment_rule = p_practice_payment_rule,
    practice_payment_custom_amount_dkk = p_practice_payment_custom_amount_dkk
  where id = p_member_id
    and team_id = target_team_id;

  insert into public.member_public_history (member_id, event_type, public_description)
  values (p_member_id, 'Admin profile updated', 'Admin updated profile details');

  insert into public.audit_log (
    team_id,
    actor_auth_user_id,
    entity_type,
    entity_id,
    action,
    old_value,
    new_value
  )
  values (
    target_team_id,
    auth.uid(),
    'member',
    p_member_id,
    'admin_update_member',
    jsonb_build_object(
      'first_name', previous_member.first_name,
      'age_group', previous_member.age_group,
      'football_level', previous_member.football_level,
      'primary_position', previous_member.primary_position,
      'secondary_position', previous_member.secondary_position,
      'residence_type', previous_member.residence_type,
      'gender', previous_member.gender,
      'membership_status', previous_member.membership_status,
      'application_role', previous_member.application_role,
      'practice_payment_rule', previous_member.practice_payment_rule,
      'practice_payment_custom_amount_dkk', previous_member.practice_payment_custom_amount_dkk
    ),
    jsonb_build_object(
      'first_name', btrim(regexp_replace(p_first_name, '\s+', ' ', 'g')),
      'age_group', p_age_group,
      'football_level', p_football_level,
      'primary_position', p_primary_position,
      'secondary_position', p_secondary_position,
      'residence_type', p_residence_type,
      'gender', p_gender,
      'membership_status', p_membership_status,
      'application_role', p_application_role,
      'practice_payment_rule', p_practice_payment_rule,
      'practice_payment_custom_amount_dkk', p_practice_payment_custom_amount_dkk
    )
  );

  return p_member_id;
exception
  when unique_violation then
    raise exception 'This name is already in use. Please choose another name or nickname.';
end;
$$;

grant execute on function public.admin_update_member(uuid, uuid, text, public.age_group, integer, public.position_code, public.position_code, public.residence_type, public.gender_type, public.membership_status, public.application_role, public.practice_payment_rule_type, integer) to authenticated;

create or replace function public.practice_payment_amount(member_row public.members)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when member_row.practice_payment_rule = 'Exempt' then 0
    when member_row.practice_payment_rule = 'Custom' then member_row.practice_payment_custom_amount_dkk
    when member_row.age_group::text = 'Under 18' or member_row.residence_type = 'Student' then 20
    else 80
  end;
$$;

create or replace function public.get_practice_payment_state(target_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_member_id uuid := public.current_member_id();
  active_member public.members%rowtype;
  practice_event public.events%rowtype;
  my_rsvp public.rsvp_status;
  my_paid_at timestamptz;
  admin_rows jsonb := '[]'::jsonb;
  expected_total integer := 0;
  paid_total integer := 0;
  paid_count integer := 0;
  unpaid_count integer := 0;
  exempt_count integer := 0;
begin
  if not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;

  if active_member_id is null then
    raise exception 'No active member profile selected';
  end if;

  select * into active_member
  from public.members
  where id = active_member_id
    and team_id = target_team_id;

  if active_member.id is null then
    raise exception 'No active member profile selected';
  end if;

  select * into practice_event
  from public.current_practice_event(target_team_id);

  if practice_event.id is null then
    return jsonb_build_object(
      'event', null,
      'myPayment', null,
      'adminPayments', '[]'::jsonb,
      'totals', jsonb_build_object(
        'expected_total_dkk', 0,
        'paid_total_dkk', 0,
        'unpaid_total_dkk', 0,
        'paid_count', 0,
        'unpaid_count', 0,
        'exempt_count', 0
      )
    );
  end if;

  select a.rsvp_status into my_rsvp
  from public.attendance a
  where a.event_id = practice_event.id
    and a.member_id = active_member_id;

  select pp.paid_at into my_paid_at
  from public.practice_payments pp
  where pp.event_id = practice_event.id
    and pp.member_id = active_member_id;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'member_id', member_payments.member_id,
        'first_name', member_payments.first_name,
        'amount_dkk', member_payments.amount_dkk,
        'payment_rule', member_payments.payment_rule,
        'is_exempt', member_payments.is_exempt,
        'rsvp_status', 'Going',
        'is_paid', member_payments.paid_at is not null,
        'paid_at', member_payments.paid_at
      )
      order by member_payments.is_exempt asc, member_payments.is_paid asc, member_payments.first_name
    ), '[]'::jsonb),
    coalesce(sum(member_payments.amount_dkk), 0),
    coalesce(sum(member_payments.amount_dkk) filter (where member_payments.paid_at is not null and not member_payments.is_exempt), 0),
    count(*) filter (where member_payments.paid_at is not null and not member_payments.is_exempt),
    count(*) filter (where member_payments.paid_at is null and not member_payments.is_exempt),
    count(*) filter (where member_payments.is_exempt)
  into admin_rows, expected_total, paid_total, paid_count, unpaid_count, exempt_count
  from (
    select
      m.id as member_id,
      m.first_name,
      public.practice_payment_amount(m) as amount_dkk,
      m.practice_payment_rule as payment_rule,
      m.practice_payment_rule = 'Exempt' as is_exempt,
      pp.paid_at,
      pp.paid_at is not null as is_paid
    from public.attendance a
    join public.members m on m.id = a.member_id
    left join public.practice_payments pp
      on pp.event_id = a.event_id
      and pp.member_id = a.member_id
    where a.event_id = practice_event.id
      and a.rsvp_status = 'Going'
      and m.team_id = target_team_id
      and m.membership_status = 'Active'
  ) member_payments;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', practice_event.id,
      'title', practice_event.title,
      'event_date', practice_event.event_date,
      'start_time', practice_event.start_time,
      'location', practice_event.location,
      'payment_deadline_date', practice_event.event_date + 1
    ),
    'myPayment', jsonb_build_object(
      'member_id', active_member.id,
      'first_name', active_member.first_name,
      'amount_dkk', public.practice_payment_amount(active_member),
      'payment_rule', active_member.practice_payment_rule,
      'is_exempt', active_member.practice_payment_rule = 'Exempt',
      'rsvp_status', my_rsvp,
      'is_paid', my_paid_at is not null,
      'paid_at', my_paid_at
    ),
    'adminPayments', case when public.is_admin(target_team_id) then admin_rows else '[]'::jsonb end,
    'totals', jsonb_build_object(
      'expected_total_dkk', case when public.is_admin(target_team_id) then expected_total else 0 end,
      'paid_total_dkk', case when public.is_admin(target_team_id) then paid_total else 0 end,
      'unpaid_total_dkk', case when public.is_admin(target_team_id) then expected_total - paid_total else 0 end,
      'paid_count', case when public.is_admin(target_team_id) then paid_count else 0 end,
      'unpaid_count', case when public.is_admin(target_team_id) then unpaid_count else 0 end,
      'exempt_count', case when public.is_admin(target_team_id) then exempt_count else 0 end
    )
  );
end;
$$;

create or replace function public.mark_practice_payment_paid(
  target_team_id uuid,
  target_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_member_id uuid := public.current_member_id();
  active_member public.members%rowtype;
  target_event public.events%rowtype;
  today date := (now() at time zone 'Europe/Copenhagen')::date;
  amount integer;
begin
  if not public.has_current_device_access(target_team_id) then
    raise exception 'Current device is not approved';
  end if;

  if active_member_id is null then
    raise exception 'No active member profile selected';
  end if;

  select * into active_member
  from public.members
  where id = active_member_id
    and team_id = target_team_id
    and membership_status = 'Active';

  if active_member.id is null then
    raise exception 'No active member profile selected';
  end if;

  if active_member.practice_payment_rule = 'Exempt' then
    raise exception 'This member is exempt from Practice payment.';
  end if;

  select * into target_event
  from public.events
  where id = target_event_id
    and team_id = target_team_id
    and title = 'Practice'
    and event_type = 'Football'
    and status <> 'Cancelled';

  if target_event.id is null then
    raise exception 'Practice event not found';
  end if;

  if today > target_event.event_date + 1 then
    raise exception 'Practice payment deadline has passed';
  end if;

  if not exists (
    select 1
    from public.attendance a
    where a.event_id = target_event_id
      and a.member_id = active_member_id
      and a.rsvp_status = 'Going'
  ) then
    raise exception 'Only Going members can mark practice payment paid.';
  end if;

  amount := public.practice_payment_amount(active_member);

  if amount <= 0 then
    raise exception 'Practice payment amount must be above 0 DKK.';
  end if;

  insert into public.practice_payments (
    team_id,
    event_id,
    member_id,
    amount_dkk,
    paid_at
  )
  values (
    target_team_id,
    target_event_id,
    active_member_id,
    amount,
    now()
  )
  on conflict (event_id, member_id)
  do update set
    amount_dkk = excluded.amount_dkk,
    paid_at = excluded.paid_at;

  return public.get_practice_payment_state(target_team_id);
end;
$$;
