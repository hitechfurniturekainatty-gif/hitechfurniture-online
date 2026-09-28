-- Run with the migration in one transaction, then ROLLBACK. No fixture survives.
DO $$
DECLARE admin_id uuid; q uuid; q2 uuid; a uuid; b uuid; foreign_item uuid; trip uuid; trip2 uuid; stop uuid; stop2 uuid; stamp timestamptz;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role='admin' LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Test needs an existing admin role'; END IF;
  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
  INSERT INTO public.quotations(quotation_id,party_name,party_place,status,commercial_status,pipeline_stage)
    VALUES('TEST-'||gen_random_uuid(),'Delivery test','Test','finalized','confirmed',6) RETURNING id INTO q;
  INSERT INTO public.quotations(quotation_id,party_name,party_place,status,commercial_status,pipeline_stage)
    VALUES('TEST-'||gen_random_uuid(),'Other test','Test','finalized','confirmed',6) RETURNING id INTO q2;
  INSERT INTO public.quotation_items(quotation_id,description,quantity,fulfillment_route) VALUES(q,'Ready test',1,'ready_stock') RETURNING id INTO a;
  INSERT INTO public.quotation_items(quotation_id,description,quantity,fulfillment_route) VALUES(q,'Custom test',1,'custom') RETURNING id INTO b;
  INSERT INTO public.quotation_items(quotation_id,description,quantity,fulfillment_route) VALUES(q2,'Unrelated',1,'ready_stock') RETURNING id INTO foreign_item;
  INSERT INTO public.trips(trip_date) VALUES(current_date) RETURNING id INTO trip;
  INSERT INTO public.trip_quotations(trip_id,quotation_id) VALUES(trip,q) RETURNING id INTO stop;
  BEGIN
    UPDATE public.trip_quotations SET delivered_at=now() WHERE id=stop;
    RAISE EXCEPTION 'TEST FAILED: blanket delivery accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Select the received items%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.trip_quotations SET delivered_at=now(),delivered_item_ids=ARRAY[foreign_item] WHERE id=stop;
    RAISE EXCEPTION 'TEST FAILED: unrelated item accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Selection includes%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.trip_quotations SET delivered_at=now(),delivered_item_ids=ARRAY[b] WHERE id=stop;
    RAISE EXCEPTION 'TEST FAILED: unfinished custom item accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Selected items must%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  BEGIN
    UPDATE public.trip_quotations SET delivered_at=now(),delivered_item_ids=ARRAY[a] WHERE id=stop;
    RAISE EXCEPTION 'TEST FAILED: unauthorized caller accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Not authorized%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
  UPDATE public.trip_quotations SET delivered_at=now(),delivered_item_ids=ARRAY[a] WHERE id=stop;
  IF (SELECT delivered_at IS NULL FROM public.quotation_items WHERE id=a) OR
     (SELECT delivered_at IS NOT NULL FROM public.quotation_items WHERE id=b) OR
     (SELECT status='delivered' FROM public.quotations WHERE id=q) THEN
    RAISE EXCEPTION 'TEST FAILED: partial delivery did not preserve remainder';
  END IF;
  SELECT delivered_at INTO stamp FROM public.trip_quotations WHERE id=stop;
  UPDATE public.trip_quotations SET delivered_at=now()+interval '1 second',delivered_item_ids=ARRAY[a] WHERE id=stop;
  IF (SELECT delivered_at<>stamp FROM public.trip_quotations WHERE id=stop) THEN RAISE EXCEPTION 'TEST FAILED: retry changed receipt'; END IF;
  UPDATE public.quotation_items SET fulfillment_route='ready_stock' WHERE id=b;
  INSERT INTO public.trips(trip_date) VALUES(current_date) RETURNING id INTO trip2;
  INSERT INTO public.trip_quotations(trip_id,quotation_id) VALUES(trip2,q) RETURNING id INTO stop2;
  UPDATE public.trip_quotations SET delivered_at=now(),delivered_item_ids=ARRAY[b] WHERE id=stop2;
  IF (SELECT status<>'delivered' FROM public.quotations WHERE id=q) THEN RAISE EXCEPTION 'TEST FAILED: final delivery did not close quotation'; END IF;
  IF (SELECT status<>'delivered' FROM public.trips WHERE id=trip2) THEN RAISE EXCEPTION 'TEST FAILED: trip did not close'; END IF;
END $$;
SELECT 'Passed: blanket-write, unrelated-item, unfinished-item and authorization guards; partial delivery, retry, final delivery' AS test_result;
