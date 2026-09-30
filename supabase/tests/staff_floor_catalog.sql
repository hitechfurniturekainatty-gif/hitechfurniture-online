BEGIN;
DO $test$
DECLARE
  admin_id uuid; category_id uuid; loc_a uuid; loc_b uuid;
  p uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); s_a uuid:=gen_random_uuid(); s_b uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid(); rejected boolean:=false; value_int integer;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role='admin' LIMIT 1;
  SELECT id INTO category_id FROM public.main_categories WHERE deleted_at IS NULL LIMIT 1;
  SELECT id INTO loc_a FROM public.product_locations WHERE is_active ORDER BY display_order,id LIMIT 1;
  SELECT id INTO loc_b FROM public.product_locations WHERE is_active AND id<>loc_a ORDER BY display_order,id LIMIT 1;
  IF admin_id IS NULL OR category_id IS NULL OR loc_b IS NULL THEN RAISE EXCEPTION 'Missing test prerequisites'; END IF;
  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  INSERT INTO public.products(id,main_category_id,mrp,product_code,product_name,stock_quantity,location_id,floor_display_order)
    VALUES(p,category_id,100,'floor-test-'||p::text,'Rollback-only floor test',5,loc_a,0);
  PERFORM public.save_staff_floor(request,'arrange',jsonb_build_array(jsonb_build_object('kind','product','id',p,'location_id',loc_a,'floor_display_order',0)),NULL);
  SELECT floor_display_order INTO value_int FROM public.products WHERE id=p;
  IF value_int<>10 THEN RAISE EXCEPTION 'Order not saved'; END IF;
  -- A stale second admin must not overwrite the saved order.
  BEGIN
    PERFORM public.save_staff_floor(gen_random_uuid(),'arrange',jsonb_build_array(jsonb_build_object('kind','product','id',p,'location_id',loc_a,'floor_display_order',0)),NULL);
  EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Stale order accepted'; END IF;
  PERFORM public.save_staff_floor(gen_random_uuid(),'move',jsonb_build_array(jsonb_build_object('kind','product','id',p,'location_id',loc_a,'floor_display_order',10)),loc_b);
  SELECT stock_quantity INTO value_int FROM public.products WHERE id=p;
  IF value_int<>5 THEN RAISE EXCEPTION 'Move changed total stock'; END IF;
  request:=gen_random_uuid();
  PERFORM public.adjust_staff_floor_stock(request,'product',p,-2,5,'sale','rollback test');
  PERFORM public.adjust_staff_floor_stock(request,'product',p,-2,5,'sale','retry');
  SELECT stock_quantity INTO value_int FROM public.products WHERE id=p;
  IF value_int<>3 THEN RAISE EXCEPTION 'Stock request not idempotent'; END IF;
  rejected:=false;
  BEGIN PERFORM public.adjust_staff_floor_stock(gen_random_uuid(),'product',p,-4,3,'sale',NULL);
  EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Negative stock accepted'; END IF;
  INSERT INTO public.product_variants(id,product_id,color_name,stock_quantity,location_id) VALUES(v,p,'Brown',3,loc_b);
  INSERT INTO public.product_variant_stock(id,variant_id,location_id,quantity,floor_display_order) VALUES(s_a,v,loc_a,1,0),(s_b,v,loc_b,2,0);
  PERFORM public.save_staff_floor(gen_random_uuid(),'move',jsonb_build_array(jsonb_build_object('kind','variant_stock','id',s_a,'location_id',loc_a,'floor_display_order',0)),loc_b);
  SELECT quantity INTO value_int FROM public.product_variant_stock WHERE id=s_b;
  IF value_int<>3 THEN RAISE EXCEPTION 'Destination stock not merged'; END IF;
  SELECT quantity INTO value_int FROM public.product_variant_stock WHERE id=s_a;
  IF value_int<>0 THEN RAISE EXCEPTION 'Source stock not cleared'; END IF;
  PERFORM public.adjust_staff_floor_stock(gen_random_uuid(),'variant_stock',s_b,-1,3,'sale',NULL);
  SELECT stock_quantity INTO value_int FROM public.products WHERE id=p;
  IF value_int<>2 THEN RAISE EXCEPTION 'Product ledger did not track colour movement'; END IF;
  SELECT stock_quantity INTO value_int FROM public.product_variants WHERE id=v;
  IF value_int<>2 THEN RAISE EXCEPTION 'Colour total not updated'; END IF;
  SELECT quantity INTO value_int FROM public.product_variant_stock WHERE id=s_b;
  IF value_int<>2 THEN RAISE EXCEPTION 'Location quantity not updated'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  rejected:=false;
  BEGIN PERFORM public.save_staff_floor(gen_random_uuid(),'arrange',jsonb_build_array(jsonb_build_object('kind','product','id',p,'location_id',loc_b,'floor_display_order',0)),NULL);
  EXCEPTION WHEN OTHERS THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Anonymous floor write accepted'; END IF;
END $test$;
ROLLBACK;
SELECT 'Passed: saved order, stale edit rejection, unchanged transfer totals, idempotent stock, oversell rejection, colour-location merge, ledger totals and anonymous denial. Test rows rolled back.' AS result;