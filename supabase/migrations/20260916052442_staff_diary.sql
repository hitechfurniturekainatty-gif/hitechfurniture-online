create table public.staff_diary_notes (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 created_by uuid not null default auth.uid() references auth.users(id),
 kind text not null default 'personal' check(kind in ('personal','assignment')),
 title text not null check(length(trim(title)) between 1 and 200),
 body text not null default '' check(length(body)<=10000),
 due_date date, reminder_at timestamptz,
 priority text not null default 'normal' check(priority in ('normal','important')),
 pinned boolean not null default false,
 status text not null default 'pending' check(status in ('pending','completed')),
 read_at timestamptz, completed_at timestamptz, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 revision integer not null default 1,
 check(kind <> 'personal' or owner_id=created_by)
);
create index staff_diary_owner_due on public.staff_diary_notes(owner_id,due_date) where deleted_at is null;
create index staff_diary_creator on public.staff_diary_notes(created_by);
alter table public.staff_diary_notes enable row level security;
revoke all on public.staff_diary_notes from anon, authenticated;
grant select,insert,update on public.staff_diary_notes to authenticated;
grant all on public.staff_diary_notes to service_role;
create policy diary_read on public.staff_diary_notes for select to authenticated using (
 exists(select 1 from public.user_roles where user_id=auth.uid()) and
 (owner_id=auth.uid() or (kind='assignment' and public.has_role(auth.uid(),'admin')))
);
create policy diary_insert on public.staff_diary_notes for insert to authenticated with check (
 created_by=auth.uid() and exists(select 1 from public.user_roles where user_id=auth.uid()) and
 ((kind='personal' and owner_id=auth.uid()) or
  (kind='assignment' and public.has_role(auth.uid(),'admin') and exists(select 1 from public.user_roles where user_id=owner_id)))
);
create policy diary_update on public.staff_diary_notes for update to authenticated using (
 exists(select 1 from public.user_roles where user_id=auth.uid()) and
 (owner_id=auth.uid() or (kind='assignment' and public.has_role(auth.uid(),'admin')))
) with check (
 exists(select 1 from public.user_roles where user_id=auth.uid()) and
 (owner_id=auth.uid() or (kind='assignment' and public.has_role(auth.uid(),'admin')))
);
create function public.guard_staff_diary() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='INSERT' then
  new.status := 'pending'; new.completed_at:=null; new.read_at:=null; new.deleted_at:=null;
  new.revision:=1; new.created_at:=now(); new.updated_at:=now();
 else
  if (new.id,new.owner_id,new.created_by,new.kind,new.created_at) is distinct from
     (old.id,old.owner_id,old.created_by,old.kind,old.created_at) then
   raise exception 'Diary ownership cannot be changed';
  end if;
  if old.kind='assignment' and not public.has_role(auth.uid(),'admin') and
    (new.title,new.body,new.due_date,new.reminder_at,new.priority,new.deleted_at) is distinct from
    (old.title,old.body,old.due_date,old.reminder_at,old.priority,old.deleted_at) then
    raise exception 'Only an admin can edit an assigned instruction';
  end if;
  if new.status='completed' then new.completed_at:=coalesce(old.completed_at,now()); else new.completed_at:=null; end if;
  new.revision:=old.revision+1; new.updated_at:=now();
 end if;
 return new;
end $$;
revoke all on function public.guard_staff_diary() from public,anon,authenticated;
create trigger guard_staff_diary before insert or update on public.staff_diary_notes for each row execute function public.guard_staff_diary();

-- Images belong to an existing note; private signed URLs never enter public catalog data.
create table public.staff_diary_images (
 id uuid primary key default gen_random_uuid(), note_id uuid not null references public.staff_diary_notes(id),
 storage_path text not null unique, caption text not null default '' check(length(caption)<=300),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
 check(split_part(storage_path,'/',1)=note_id::text)
);
create index staff_diary_images_note on public.staff_diary_images(note_id);
alter table public.staff_diary_images enable row level security;
revoke all on public.staff_diary_images from anon,authenticated;
grant select,insert,delete on public.staff_diary_images to authenticated;
grant all on public.staff_diary_images to service_role;
create policy diary_images_read on public.staff_diary_images for select to authenticated using (
 exists(select 1 from public.staff_diary_notes n where n.id=note_id and n.deleted_at is null)
);
create policy diary_images_insert on public.staff_diary_images for insert to authenticated with check (
 created_by=auth.uid() and exists(select 1 from public.staff_diary_notes n where n.id=note_id and n.deleted_at is null)
);
create policy diary_images_delete on public.staff_diary_images for delete to authenticated using (
 exists(select 1 from public.staff_diary_notes n where n.id=note_id and n.deleted_at is null)
 and (created_by=auth.uid() or public.has_role(auth.uid(),'admin'))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('staff-diary','staff-diary',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy diary_storage_read on storage.objects for select to authenticated using (
 bucket_id='staff-diary' and exists(select 1 from public.staff_diary_notes n where n.id::text=split_part(name,'/',1) and n.deleted_at is null)
);
create policy diary_storage_insert on storage.objects for insert to authenticated with check (
 bucket_id='staff-diary' and exists(select 1 from public.staff_diary_notes n where n.id::text=split_part(name,'/',1) and n.deleted_at is null)
);
create policy diary_storage_delete on storage.objects for delete to authenticated using (
 bucket_id='staff-diary' and (owner_id=auth.uid()::text or public.has_role(auth.uid(),'admin'))
 and exists(select 1 from public.staff_diary_notes n where n.id::text=split_part(name,'/',1) and n.deleted_at is null)
);

-- Live source records: no duplicated task status and no price fields.
create view public.staff_diary_tasks with (security_invoker=true) as
 select m.id,'measurement'::text source, 'Measurement · '||m.customer_name title,m.requirement body,
 m.visit_date due_date,m.status='completed' completed,'/admin/measurement-tasks?task='||m.id href
 from public.measurement_tasks m where m.assigned_to=auth.uid() and m.deleted_at is null
 union all
 select f.id,'followup','Follow-up · '||coalesce(q.party_name,'Customer'), f.note,
 (f.scheduled_for at time zone 'Asia/Kolkata')::date,f.status='completed', '/admin/quotations/'||f.quotation_id
 from public.quotation_followups f join public.quotations q on q.id=f.quotation_id
 where f.assigned_to=auth.uid() and f.status<>'cancelled' and q.deleted_at is null
 union all
 select j.id,case when j.job_type in ('complaint','service','installation') then j.job_type else 'production' end,
 initcap(coalesce(j.job_type,'production'))||' · '||left(coalesce(j.notes,'Assigned work'),90),j.notes,
 (j.due_at at time zone 'Asia/Kolkata')::date,j.status in ('ready','delivered'),'/worker/job/'||j.id
 from public.job_work_orders j join public.workers w on w.id=j.worker_id
 where w.user_id=auth.uid() and j.deleted_at is null
 union all
 select t.id,'delivery','Delivery trip',t.notes,t.trip_date,t.status='delivered','/admin/my-trips'
 from public.trips t where t.assigned_driver_id=auth.uid() and t.deleted_at is null and t.status<>'cancelled';
revoke all on public.staff_diary_tasks from anon;
grant select on public.staff_diary_tasks to authenticated,service_role;

-- Future integrations: disabled and service-only writes. No cron, webhook or outbound send is installed.
create table public.staff_diary_integrations (
 channel text primary key check(channel in ('whatsapp','automation')),
 enabled boolean not null default false, settings jsonb not null default '{}'
);
insert into public.staff_diary_integrations(channel) values('whatsapp'),('automation');
alter table public.staff_diary_integrations enable row level security;
revoke all on public.staff_diary_integrations from anon,authenticated;
grant select on public.staff_diary_integrations to authenticated;
grant all on public.staff_diary_integrations to service_role;
create policy diary_integrations_admin on public.staff_diary_integrations for select to authenticated using(public.has_role(auth.uid(),'admin'));
create table public.staff_diary_delivery_log (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 channel text not null, idempotency_key text not null unique,
 status text not null check(status in ('queued','sent','failed','cancelled')),
 provider_id text, error text, created_at timestamptz not null default now(), sent_at timestamptz
);
alter table public.staff_diary_delivery_log enable row level security;
revoke all on public.staff_diary_delivery_log from anon,authenticated;
grant select on public.staff_diary_delivery_log to authenticated;
grant all on public.staff_diary_delivery_log to service_role;
create policy diary_delivery_admin on public.staff_diary_delivery_log for select to authenticated using(public.has_role(auth.uid(),'admin'));
create table public.staff_diary_notification_preferences (
 user_id uuid primary key references auth.users(id), timezone text not null default 'Asia/Kolkata',
 digest_time time not null default '10:00', whatsapp_opt_in_at timestamptz,
 whatsapp_number text, updated_at timestamptz not null default now()
);
alter table public.staff_diary_notification_preferences enable row level security;
revoke all on public.staff_diary_notification_preferences from anon,authenticated;
grant select on public.staff_diary_notification_preferences to authenticated;
grant all on public.staff_diary_notification_preferences to service_role;
create policy diary_preferences_self on public.staff_diary_notification_preferences for select to authenticated using(user_id=auth.uid());

-- Transactional audit for future polling; excludes note text and images.
create table public.staff_diary_events (
 id bigint generated always as identity primary key, note_id uuid not null references public.staff_diary_notes(id),
 actor_id uuid, revision integer not null, event_type text not null, occurred_at timestamptz not null default now(),
 unique(note_id,revision)
);
alter table public.staff_diary_events enable row level security;
revoke all on public.staff_diary_events from anon,authenticated;
grant select on public.staff_diary_events to authenticated;
grant all on public.staff_diary_events to service_role;
grant usage,select on sequence public.staff_diary_events_id_seq to service_role;
create policy diary_events_read on public.staff_diary_events for select to authenticated using(exists(select 1 from public.staff_diary_notes n where n.id=note_id));
create schema if not exists diary_private;
revoke all on schema diary_private from public,anon,authenticated;
create function diary_private.record_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Diary changes require an authenticated actor'; end if;
 insert into public.staff_diary_events(note_id,actor_id,revision,event_type) values(new.id,auth.uid(),new.revision,
 case when TG_OP='INSERT' then 'created' when new.deleted_at is not null then 'deleted'
 when new.status is distinct from old.status then new.status
 when (new.due_date,new.reminder_at) is distinct from (old.due_date,old.reminder_at) then 'rescheduled'
 when new.read_at is distinct from old.read_at then 'read' else 'updated' end);
 return new;
end $$;
revoke all on function diary_private.record_event() from public,anon,authenticated;
create trigger diary_record_event after insert or update on public.staff_diary_notes for each row execute function diary_private.record_event();
