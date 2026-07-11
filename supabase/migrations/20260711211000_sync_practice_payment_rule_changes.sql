alter table public.practice_payments
  drop constraint if exists practice_payments_amount_dkk_check;

alter table public.practice_payments
  add constraint practice_payments_amount_dkk_check
  check (amount_dkk >= 0);

create or replace function public.sync_member_practice_payment_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.age_group is distinct from new.age_group
    or old.residence_type is distinct from new.residence_type
    or old.membership_status is distinct from new.membership_status
    or old.practice_payment_rule is distinct from new.practice_payment_rule
    or old.practice_payment_custom_amount_dkk is distinct from new.practice_payment_custom_amount_dkk
  then
    update public.practice_payments pp
    set amount_dkk = public.practice_payment_amount(new)
    from public.events e
    where e.id = pp.event_id
      and e.team_id = new.team_id
      and e.title = 'Practice'
      and e.event_type = 'Football'
      and e.status <> 'Cancelled'
      and pp.team_id = new.team_id
      and pp.member_id = new.id
      and e.event_date >= (now() at time zone 'Europe/Copenhagen')::date - 7;
  end if;

  return new;
end;
$$;

drop trigger if exists members_sync_practice_payment_amounts on public.members;
create trigger members_sync_practice_payment_amounts
after update of age_group, residence_type, membership_status, practice_payment_rule, practice_payment_custom_amount_dkk
on public.members
for each row
execute function public.sync_member_practice_payment_amounts();
