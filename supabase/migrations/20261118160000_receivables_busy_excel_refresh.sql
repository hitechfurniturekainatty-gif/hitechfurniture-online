-- Receivables: support "Refresh balances from Busy Excel" (additive).
-- account_key  = normalised Busy account text; one receivable per Busy account.
-- salesman     = owner of the customer (from the Excel Sales Man column).
-- last_upload_at = when a Busy refresh last touched the row.
-- RLS is unchanged: only admins can read or write receivables.

alter table public.receivables
  add column if not exists account_key text,
  add column if not exists salesman text,
  add column if not exists last_upload_at timestamptz;

create unique index if not exists receivables_account_key_uidx on public.receivables (account_key);
create index if not exists receivables_salesman_idx on public.receivables (salesman) where salesman is not null;

-- Rows created by the Busy refresh must not get the automatic 1/3/7/15-day reminders:
-- ~1000 customers would create ~4000 follow-ups and flood the notification bell.
-- Rows without account_key (manual / pasted / order-linked) behave exactly as before.
create or replace function public.receivable_autoschedule()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.account_key is null
     and new.closed_at is null and coalesce(new.pending_amount,0) > 0
     and not exists (select 1 from public.receivable_followups f where f.receivable_id=new.id and f.status='pending') then
    insert into public.receivable_followups(receivable_id, scheduled_for, status, note)
    select new.id, public.next_ist_slot(d), 'pending', 'ഓട്ടോ റിമൈൻഡർ (+'||d||' ദിവസം)'
      from unnest(array[1,3,7,15]) d;
  end if;
  return null;
end $function$;
