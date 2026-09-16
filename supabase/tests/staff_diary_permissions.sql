-- Live smoke test. All test records and events are rolled back; no auth accounts are created.
begin;
select set_config('diary_test.admin',(select user_id::text from public.user_roles where role='admin' limit 1),true);
select set_config('diary_test.staff',(select user_id::text from public.user_roles r where not exists(select 1 from public.user_roles a where a.user_id=r.user_id and a.role='admin') limit 1),true);
select set_config('diary_test.other',(select user_id::text from public.user_roles r where user_id::text<>current_setting('diary_test.staff') and not exists(select 1 from public.user_roles a where a.user_id=r.user_id and a.role='admin') limit 1),true);
select set_config('diary_test.note',gen_random_uuid()::text,true),set_config('diary_test.assignment',gen_random_uuid()::text,true);
do $$begin if nullif(current_setting('diary_test.other'),'') is null then raise exception 'Three staff identities are required for this test'; end if; end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('diary_test.staff'),true);
insert into public.staff_diary_notes(id,owner_id,title) values(current_setting('diary_test.note')::uuid,auth.uid(),'Diary permission smoke test');
insert into storage.objects(bucket_id,name,owner_id) values('staff-diary',current_setting('diary_test.note')||'/test.jpg',auth.uid()::text);
select set_config('request.jwt.claim.sub',current_setting('diary_test.other'),true);
do $$begin
 if exists(select 1 from public.staff_diary_notes where id=current_setting('diary_test.note')::uuid) then raise exception 'Other staff saw private note'; end if;
 if exists(select 1 from storage.objects where bucket_id='staff-diary' and name=current_setting('diary_test.note')||'/test.jpg') then raise exception 'Other staff saw private image'; end if;
 begin
  insert into public.staff_diary_notes(owner_id,kind,title) values(current_setting('diary_test.staff')::uuid,'assignment','Forbidden assignment');
  raise exception 'Non-admin assignment succeeded';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub',current_setting('diary_test.admin'),true);
do $$begin
 if exists(select 1 from public.staff_diary_notes where id=current_setting('diary_test.note')::uuid) then raise exception 'Admin saw personal note'; end if;
 if exists(select 1 from storage.objects where bucket_id='staff-diary' and name=current_setting('diary_test.note')||'/test.jpg') then raise exception 'Admin saw personal image'; end if;
end$$;
insert into public.staff_diary_notes(id,owner_id,kind,title) values(current_setting('diary_test.assignment')::uuid,current_setting('diary_test.staff')::uuid,'assignment','Assigned smoke test');
select set_config('request.jwt.claim.sub',current_setting('diary_test.staff'),true);
do $$begin
 begin
  update public.staff_diary_notes set title='Forbidden change' where id=current_setting('diary_test.assignment')::uuid;
  raise exception 'Assignee edit unexpectedly succeeded';
 exception when raise_exception then if sqlerrm <> 'Only an admin can edit an assigned instruction' then raise; end if; end;
 begin
  update public.staff_diary_notes set owner_id=current_setting('diary_test.other')::uuid where id=current_setting('diary_test.note')::uuid;
  raise exception 'Owner reassignment unexpectedly succeeded';
 exception when raise_exception then if sqlerrm <> 'Diary ownership cannot be changed' then raise; end if; end;
end$$;
update public.staff_diary_notes set read_at=now(),status='completed' where id=current_setting('diary_test.assignment')::uuid;
do $$begin
 if not exists(select 1 from public.staff_diary_notes where id=current_setting('diary_test.assignment')::uuid and completed_at is not null and read_at is not null and revision=2) then raise exception 'Completion or read state failed'; end if;
 if not exists(select 1 from public.staff_diary_events where note_id=current_setting('diary_test.assignment')::uuid and event_type='completed') then raise exception 'Audit event missing'; end if;
end$$;
update public.staff_diary_notes set status='pending' where id=current_setting('diary_test.assignment')::uuid;
do $$begin
 if not exists(select 1 from public.staff_diary_notes where id=current_setting('diary_test.assignment')::uuid and completed_at is null and status='pending') then raise exception 'Undo failed'; end if;
end$$;
select count(*) as accessible_source_tasks from public.staff_diary_tasks;
reset role;
rollback;
select 'PASS: private notes/images, admin assignment, immutable ownership, read/completion/undo, audit and source view' as result;
