do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'apply_product_price_change',
        'backlog_pin_is_set',
        'catalog_pin_is_set',
        'consume_bundle_stock',
        'current_worker_id',
        'handle_new_user',
        'has_role',
        'next_complaint_id',
        'next_po_id',
        'next_quotation_id',
        'next_service_id',
        'override_advance_quotation',
        'purge_old_trash',
        'quotations_status_audit',
        'recompute_bundle_stock',
        'reject_quotation',
        'resolve_role_recipients',
        'set_backlog_pin',
        'set_catalog_pin',
        'set_quotation_stage',
        'start_lead_chat',
        'verify_backlog_pin',
        'verify_catalog_pin'
      ])
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon',
      r.schema_name,
      r.function_name,
      r.args
    );
    execute format(
      'grant execute on function %I.%I(%s) to authenticated, service_role',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end $$;
