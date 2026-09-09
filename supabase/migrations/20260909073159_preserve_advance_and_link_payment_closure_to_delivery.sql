CREATE OR REPLACE FUNCTION public.sync_receivable_to_quotation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE delivered boolean;
BEGIN
 IF new.source='quotation' AND new.quotation_id IS NOT NULL THEN
  SELECT q.status IN ('delivered','completed') INTO delivered FROM public.quotations q WHERE q.id=new.quotation_id;
  IF coalesce(new.pending_amount,0)<=0 THEN
   new.closed_at=coalesce(new.closed_at,now());
   IF delivered THEN
    UPDATE public.quotations SET commercial_status='closed' WHERE id=new.quotation_id AND commercial_status NOT IN ('lost','closed');
   END IF;
  ELSE
   new.closed_at=NULL;
   new.closed_by=NULL;
   IF delivered THEN
    UPDATE public.quotations SET commercial_status='payment_pending' WHERE id=new.quotation_id AND commercial_status NOT IN ('lost','payment_pending');
   END IF;
  END IF;
 END IF;
 RETURN new;
END; $$;
CREATE OR REPLACE FUNCTION public.apply_receivable_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _current numeric;
  _remaining numeric;
  _qid uuid;
  _q_status text;
  _q_commercial text;
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select coalesce(pending_amount,0), quotation_id
    into _current, _qid
  from public.receivables
  where id=new.receivable_id
  for update;

  if not found then
    raise exception 'Receivable not found';
  end if;

  if new.amount > _current then
    raise exception 'Payment amount (%) exceeds pending balance (%)', new.amount, _current;
  end if;

  _remaining := greatest(_current-new.amount,0);

  update public.receivables
     set pending_amount=_remaining,
         closed_at=case when _remaining<=0 then coalesce(closed_at,now()) else null end
   where id=new.receivable_id;

  if _qid is not null then
    select status, commercial_status into _q_status, _q_commercial
      from public.quotations where id=_qid;

    if _remaining<=0 then
      if _q_status in ('delivered','completed') then
        update public.quotations
           set commercial_status='closed'
         where id=_qid and commercial_status <> 'lost';
      end if;
    else
      update public.quotations
         set commercial_status='payment_pending'
       where id=_qid and commercial_status <> 'lost';
    end if;
  end if;

  return new;
end
$function$;
CREATE OR REPLACE FUNCTION public.sync_quotation_receivable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _order_balance numeric;
  _paid numeric;
  _remaining numeric;
  _delivered boolean;
begin
  _order_balance := greatest(coalesce(new.total,0) - coalesce(new.advance_amount,0), 0);
  _delivered := new.status in ('delivered','completed');

  select coalesce(sum(rp.amount),0)
    into _paid
  from public.receivable_payments rp
  join public.receivables r on r.id=rp.receivable_id
  where r.quotation_id=new.id and r.source='quotation';

  _remaining := greatest(_order_balance - _paid, 0);

  if _delivered and _order_balance > 0 then
    insert into public.receivables(
      quotation_id, source, bill_no, customer_name, place, phone,
      pending_amount, original_amount, notes, closed_at, closed_by
    ) values (
      new.id, 'quotation', new.quotation_id, new.party_name,
      coalesce(new.delivery_place,new.party_place), new.party_phone,
      _remaining, _order_balance, 'Auto-linked from delivered quotation',
      case when _remaining<=0 then now() else null end, null
    )
    on conflict (quotation_id) where source='quotation'
    do update set
      bill_no=excluded.bill_no,
      customer_name=excluded.customer_name,
      place=excluded.place,
      phone=excluded.phone,
      pending_amount=_remaining,
      original_amount=greatest(coalesce(public.receivables.original_amount,0), _order_balance),
      closed_at=case when _remaining<=0 then coalesce(public.receivables.closed_at,now()) else null end,
      closed_by=case when _remaining<=0 then public.receivables.closed_by else null end;

    if _remaining<=0 then
      if new.commercial_status not in ('closed','lost') then
        update public.quotations set commercial_status='closed' where id=new.id;
      end if;
    elsif new.commercial_status not in ('payment_pending','lost') then
      update public.quotations set commercial_status='payment_pending' where id=new.id;
    end if;
  elsif _delivered and _order_balance <= 0 then
    update public.receivables
       set pending_amount=0,
           closed_at=coalesce(closed_at,now())
     where quotation_id=new.id and source='quotation'
       and (pending_amount is distinct from 0 or closed_at is null);

    if new.commercial_status not in ('closed','lost') then
      update public.quotations set commercial_status='closed' where id=new.id;
    end if;
  end if;

  return new;
end;
$function$;

