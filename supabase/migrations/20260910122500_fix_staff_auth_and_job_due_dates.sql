-- Repair legacy auth rows that can make GoTrue admin user updates fail with
-- "Database error loading user". Supabase Auth expects these token fields to
-- be strings (empty string when unused), not NULL.
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
where confirmation_token is null
   or recovery_token is null
   or email_change_token_new is null
   or email_change is null;

-- Job work deadline defaults to one day before the quotation delivery date.
-- Keep this helper private; it is trigger-only and does not need Data API exposure.
create schema if not exists private;

create or replace function private.set_job_work_due_from_quotation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.due_at is null and new.quotation_id is not null then
    select case
      when q.expected_delivery_date is null then null
      else (((q.expected_delivery_date - 1)::date + time '18:00') at time zone 'Asia/Kolkata')
    end
    into new.due_at
    from public.quotations q
    where q.id = new.quotation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_job_work_due_from_quotation on public.job_work_orders;
create trigger set_job_work_due_from_quotation
before insert on public.job_work_orders
for each row execute function private.set_job_work_due_from_quotation();

-- Backfill only unfinished, non-deleted jobs that already have a quotation delivery date.
update public.job_work_orders j
set due_at = (((q.expected_delivery_date - 1)::date + time '18:00') at time zone 'Asia/Kolkata')
from public.quotations q
where j.quotation_id = q.id
  and j.due_at is null
  and q.expected_delivery_date is not null
  and j.deleted_at is null
  and coalesce(j.status, '') not in ('delivered', 'completed', 'done');
