-- The invoker view needs read permission on its source table. Existing office/admin
-- RLS still controls the rows; this does not grant worker access to sales follow-ups.
grant select on public.quotation_followups to authenticated;
