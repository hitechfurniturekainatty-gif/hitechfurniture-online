-- Transactional integration test. Synthetic orders/payments and queued DB notifications roll back.
BEGIN;
INSERT INTO public.quotations(id,quotation_id,party_name,party_place,status,total,advance_amount)
VALUES('7179221d-0d6b-44b7-b79e-56dac0cae675','TEST-PAYMENT-CLOSURE','Test only','Test only','delivered',1000,200);
DO $$ DECLARE rid uuid; BEGIN
 SELECT id INTO rid FROM public.receivables WHERE quotation_id='7179221d-0d6b-44b7-b79e-56dac0cae675' AND source='quotation';
 BEGIN
  UPDATE public.quotations SET commercial_status='closed' WHERE id='7179221d-0d6b-44b7-b79e-56dac0cae675';
  RAISE EXCEPTION 'Unpaid order closure accepted' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 IF rid IS NULL THEN RAISE EXCEPTION 'Delivery did not create receivable'; END IF;
 IF (SELECT pending_amount FROM public.receivables WHERE id=rid)<>800 THEN RAISE EXCEPTION 'Opening balance incorrect'; END IF;
 INSERT INTO public.receivable_payments(receivable_id,amount) VALUES(rid,300);
 IF (SELECT pending_amount FROM public.receivables WHERE id=rid)<>500 THEN RAISE EXCEPTION 'Partial payment balance incorrect'; END IF;
 IF (SELECT advance_amount FROM public.quotations WHERE id='7179221d-0d6b-44b7-b79e-56dac0cae675')<>200 THEN RAISE EXCEPTION 'Partial payment changed advance'; END IF;
 INSERT INTO public.receivable_payments(receivable_id,amount) VALUES(rid,500);
 IF (SELECT commercial_status FROM public.quotations WHERE id='7179221d-0d6b-44b7-b79e-56dac0cae675')<>'closed' THEN RAISE EXCEPTION 'Paid delivery not closed'; END IF;
 IF (SELECT advance_amount FROM public.quotations WHERE id='7179221d-0d6b-44b7-b79e-56dac0cae675')<>200 THEN RAISE EXCEPTION 'Settlement overwrote advance'; END IF;
 UPDATE public.quotations SET total=1200 WHERE id='7179221d-0d6b-44b7-b79e-56dac0cae675';
 IF (SELECT pending_amount FROM public.receivables WHERE id=rid)<>200 THEN RAISE EXCEPTION 'Revised order balance incorrect'; END IF;
 IF (SELECT commercial_status FROM public.quotations WHERE id='7179221d-0d6b-44b7-b79e-56dac0cae675')<>'payment_pending' THEN RAISE EXCEPTION 'Revised balance did not reopen collection'; END IF;
END $$;
INSERT INTO public.quotations(id,quotation_id,party_name,party_place,status,total,advance_amount)
VALUES('6579221d-0d6b-44b7-b79e-56dac0cae675','TEST-PREPAID-CLOSURE','Test only','Test only','drafted',1000,1000);
DO $$ BEGIN
 BEGIN
  UPDATE public.quotations SET commercial_status='closed' WHERE id='6579221d-0d6b-44b7-b79e-56dac0cae675';
  RAISE EXCEPTION 'Undelivered closure accepted' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
END $$;
ROLLBACK;
