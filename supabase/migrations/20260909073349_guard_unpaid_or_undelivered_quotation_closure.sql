CREATE OR REPLACE FUNCTION public.guard_quotation_closure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE paid numeric;
BEGIN
 IF new.commercial_status='closed' AND (TG_OP='INSERT' OR old.commercial_status IS DISTINCT FROM 'closed') THEN
  IF new.status NOT IN ('delivered','completed') THEN RAISE EXCEPTION 'Complete delivery before closing this quotation'; END IF;
  SELECT coalesce(sum(p.amount),0) INTO paid FROM public.receivable_payments p JOIN public.receivables r ON r.id=p.receivable_id WHERE r.quotation_id=new.id AND r.source='quotation';
  IF coalesce(new.total,0)-coalesce(new.advance_amount,0)-paid>0 THEN RAISE EXCEPTION 'Record the remaining payment before closing this quotation'; END IF;
 END IF;
 RETURN new;
END; $$;
REVOKE ALL ON FUNCTION public.guard_quotation_closure() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_quotation_closure BEFORE INSERT OR UPDATE OF commercial_status ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.guard_quotation_closure();
