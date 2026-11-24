-- Supplier orders, supplier rate card and reorder signals (2026-11-24)
--
-- Hitech has no own manufacturing: custom pieces are ordered from suppliers (creditors)
-- and stock is bought in. Three gaps this closes:
--   1. Custom items on confirmed orders were forgotten (nobody ordered them, or nobody
--      chased the supplier). supplier_orders records who it was ordered from, when, and
--      the promised date; a daily check alerts the office about late orders and about
--      confirmed custom items that were never ordered.
--   2. Price for a custom piece took days (phone every supplier). supplier_rates holds
--      each supplier's rate per sq ft / running ft / piece; staff see only the selling
--      rate through rate_card(), admins also see cost.
--   3. Stock bought twice. reorder_signals() gives per product what was sold in 90 days
--      and what is already on order from a supplier, for the Reorder Report.

-- ── 1. Supplier orders ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE CASCADE,
  quotation_item_id uuid REFERENCES public.quotation_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  supplier_name text NOT NULL CHECK (length(btrim(supplier_name)) BETWEEN 1 AND 120),
  item_text text CHECK (item_text IS NULL OR length(item_text) <= 300),
  qty numeric NOT NULL DEFAULT 1 CHECK (qty > 0),
  ordered_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  expected_on date NOT NULL,
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'received', 'cancelled')),
  received_on date,
  note text CHECK (note IS NULL OR length(note) <= 500),
  alerted_on date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT so_dates CHECK (expected_on >= ordered_on),
  CONSTRAINT so_has_what CHECK (quotation_item_id IS NOT NULL OR product_id IS NOT NULL OR item_text IS NOT NULL),
  CONSTRAINT so_received_date CHECK (status <> 'received' OR received_on IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS supplier_orders_open_idx ON public.supplier_orders(status, expected_on);
CREATE INDEX IF NOT EXISTS supplier_orders_quotation_idx ON public.supplier_orders(quotation_id);
CREATE INDEX IF NOT EXISTS supplier_orders_item_idx ON public.supplier_orders(quotation_item_id);
CREATE INDEX IF NOT EXISTS supplier_orders_product_idx ON public.supplier_orders(product_id) WHERE status = 'ordered';

CREATE OR REPLACE FUNCTION public.supplier_orders_touch() RETURNS trigger
  LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'received' AND NEW.received_on IS NULL THEN
    NEW.received_on := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  END IF;
  IF NEW.status <> 'received' THEN NEW.received_on := NULL; END IF;
  -- A new promised date re-arms the late alert.
  IF TG_OP = 'UPDATE' AND NEW.expected_on IS DISTINCT FROM OLD.expected_on THEN NEW.alerted_on := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS supplier_orders_touch ON public.supplier_orders;
CREATE TRIGGER supplier_orders_touch BEFORE INSERT OR UPDATE ON public.supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.supplier_orders_touch();

ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS so_select ON public.supplier_orders;
CREATE POLICY so_select ON public.supplier_orders FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR public.has_role((SELECT auth.uid()), 'staff'::public.app_role)
         OR public.has_role((SELECT auth.uid()), 'warehouse'::public.app_role));
DROP POLICY IF EXISTS so_insert ON public.supplier_orders;
CREATE POLICY so_insert ON public.supplier_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR public.has_role((SELECT auth.uid()), 'staff'::public.app_role));
DROP POLICY IF EXISTS so_update ON public.supplier_orders;
CREATE POLICY so_update ON public.supplier_orders FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR public.has_role((SELECT auth.uid()), 'staff'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR public.has_role((SELECT auth.uid()), 'staff'::public.app_role));
-- No DELETE: a wrong entry is set to 'cancelled', so the history stays.
GRANT SELECT, INSERT, UPDATE ON public.supplier_orders TO authenticated;
GRANT ALL ON public.supplier_orders TO service_role;

-- Custom items on confirmed, undelivered orders that have no live supplier order.
CREATE OR REPLACE FUNCTION public.custom_items_not_ordered()
RETURNS TABLE (item_id uuid, quotation_id uuid, quotation_code text, party_name text, party_place text,
               description text, quantity numeric, image_url text, expected_delivery_date date, confirmed_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT qi.id, q.id, q.quotation_id, q.party_name, q.party_place,
         qi.description, qi.quantity,
         coalesce(nullif(qi.item_image_url, ''), nullif(qi.sketch_url, ''), nullif(qi.measurement_image_url, ''), nullif(qi.catalog_image_url, '')),
         q.expected_delivery_date::date, q.confirmed_at
    FROM public.quotation_items qi
    JOIN public.quotations q ON q.id = qi.quotation_id
   WHERE (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role)
          OR public.has_role(auth.uid(), 'warehouse'::public.app_role))
     AND q.deleted_at IS NULL
     AND coalesce(q.document_type, 'quotation') <> 'po'
     AND coalesce(q.status, '') NOT IN ('rejected', 'delivered')
     AND (coalesce(q.status, '') IN ('finalized', 'completed')
          OR coalesce(q.commercial_status, '') IN ('confirmed', 'payment_pending'))
     AND (qi.fulfillment_route = 'custom' OR qi.stock_decision = 'custom')
     AND qi.delivered_at IS NULL
     AND coalesce(qi.cancelled_qty, 0) < coalesce(qi.quantity, 1)
     AND NOT EXISTS (SELECT 1 FROM public.supplier_orders so
                      WHERE so.quotation_item_id = qi.id AND so.status IN ('ordered', 'received'))
   ORDER BY q.expected_delivery_date NULLS LAST, q.confirmed_at NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.custom_items_not_ordered() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.custom_items_not_ordered() TO authenticated, service_role;

-- Alerts: keep the live list of source types and add 'supplier_order'.
ALTER TABLE public.pipeline_notifications DROP CONSTRAINT IF EXISTS pipeline_notifications_source_type_check;
ALTER TABLE public.pipeline_notifications ADD CONSTRAINT pipeline_notifications_source_type_check CHECK (source_type = ANY (ARRAY[
  'quotation', 'lead', 'complaint', 'service', 'job', 'delivery', 'lead_reminder', 'job_stuck', 'payment_reminder',
  'quotation_expiry', 'delivery_review', 'whatsapp_lead', 'lead_chat', 'delivery_prep', 'quotation_followup_due',
  'receivable_followup_due', 'sales_lead_reminder', 'customer_approval', 'daily_call_list', 'job_status_digest',
  'review_request', 'owner_daily_report', 'weekly_source_report', 'sales_lead_followup_due',
  'sales_lead_followup_overdue', 'delivery_collection', 'supplier_order']::text[]));

-- Daily (10:00 AM India): one alert per late supplier order (repeats every 2 days while
-- still late), plus one summary of confirmed custom items nobody has ordered yet.
CREATE OR REPLACE FUNCTION public.check_supplier_orders() RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_n int := 0;
  r record;
  v_missing int;
  v_list text;
BEGIN
  FOR r IN
    SELECT so.id, so.quotation_id, so.supplier_name, so.expected_on,
           coalesce(nullif(so.item_text, ''), qi.description, p.product_name, 'Item') AS what,
           q.quotation_id AS code, q.party_name
      FROM public.supplier_orders so
      LEFT JOIN public.quotation_items qi ON qi.id = so.quotation_item_id
      LEFT JOIN public.products p ON p.id = so.product_id
      LEFT JOIN public.quotations q ON q.id = so.quotation_id
     WHERE so.status = 'ordered' AND so.expected_on < v_today
       AND (so.alerted_on IS NULL OR so.alerted_on <= v_today - 2)
  LOOP
    INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, title, body)
    VALUES (r.quotation_id, 4, 'admin'::public.app_role, 'supplier_order', r.id,
            'Supplier late · ' || r.supplier_name,
            left(r.what, 80) || ' — promised ' || to_char(r.expected_on, 'DD Mon') || ' (' || (v_today - r.expected_on) || ' days late)'
              || CASE WHEN r.party_name IS NOT NULL THEN ' · for ' || r.party_name || coalesce(' · ' || r.code, '') ELSE ' · stock purchase' END
              || '. Call the supplier and update the date.');
    UPDATE public.supplier_orders SET alerted_on = v_today WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;

  SELECT count(*), string_agg(DISTINCT coalesce(q.party_name, 'Customer'), ', ')
    INTO v_missing, v_list
    FROM public.quotation_items qi
    JOIN public.quotations q ON q.id = qi.quotation_id
   WHERE q.deleted_at IS NULL AND coalesce(q.document_type, 'quotation') <> 'po'
     AND coalesce(q.status, '') NOT IN ('rejected', 'delivered')
     AND (coalesce(q.status, '') IN ('finalized', 'completed') OR coalesce(q.commercial_status, '') IN ('confirmed', 'payment_pending'))
     AND (qi.fulfillment_route = 'custom' OR qi.stock_decision = 'custom')
     AND qi.delivered_at IS NULL AND coalesce(qi.cancelled_qty, 0) < coalesce(qi.quantity, 1)
     AND coalesce(q.confirmed_at, q.updated_at) < now() - interval '1 day'
     AND NOT EXISTS (SELECT 1 FROM public.supplier_orders so WHERE so.quotation_item_id = qi.id AND so.status IN ('ordered', 'received'));
  IF v_missing > 0 AND NOT EXISTS (
       SELECT 1 FROM public.pipeline_notifications
        WHERE source_type = 'supplier_order' AND title LIKE 'Not ordered yet%'
          AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = v_today) THEN
    INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, source_type, source_id, title, body)
    VALUES (NULL, 4, 'admin'::public.app_role, 'supplier_order', NULL,
            'Not ordered yet · ' || v_missing || ' custom item(s)',
            'Confirmed orders with custom items not yet ordered from a supplier: ' || left(v_list, 300)
              || '. Open Operations → Supplier Orders → Not ordered yet.');
    v_n := v_n + 1;
  END IF;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.check_supplier_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_supplier_orders() TO service_role;

DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'check_supplier_orders';
  PERFORM cron.schedule('check_supplier_orders', '30 4 * * *', 'select public.check_supplier_orders()');
END $$;

-- ── 2. Supplier rate card ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL CHECK (length(btrim(supplier_name)) BETWEEN 1 AND 120),
  item_type text NOT NULL CHECK (length(btrim(item_type)) BETWEEN 1 AND 80),
  material text CHECK (material IS NULL OR length(material) <= 120),
  unit text NOT NULL DEFAULT 'sqft' CHECK (unit IN ('sqft', 'rft', 'piece', 'seat', 'set')),
  cost_rate numeric NOT NULL CHECK (cost_rate >= 0),
  sell_rate numeric NOT NULL CHECK (sell_rate >= 0),
  days_to_make int CHECK (days_to_make IS NULL OR days_to_make BETWEEN 0 AND 365),
  note text CHECK (note IS NULL OR length(note) <= 300),
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_rates_type_idx ON public.supplier_rates(item_type) WHERE is_active;

CREATE OR REPLACE FUNCTION public.supplier_rates_touch() RETURNS trigger
  LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at := now(); NEW.updated_by := coalesce(auth.uid(), NEW.updated_by); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS supplier_rates_touch ON public.supplier_rates;
CREATE TRIGGER supplier_rates_touch BEFORE INSERT OR UPDATE ON public.supplier_rates
  FOR EACH ROW EXECUTE FUNCTION public.supplier_rates_touch();

-- Cost is admin-only: the table itself is admin-only; everyone else uses rate_card().
ALTER TABLE public.supplier_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_admin_all ON public.supplier_rates;
CREATE POLICY sr_admin_all ON public.supplier_rates FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_rates TO authenticated;
GRANT ALL ON public.supplier_rates TO service_role;

CREATE OR REPLACE FUNCTION public.rate_card()
RETURNS TABLE (id uuid, supplier_name text, item_type text, material text, unit text, sell_rate numeric,
               days_to_make int, note text, updated_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.id, r.supplier_name, r.item_type, r.material, r.unit, r.sell_rate, r.days_to_make, r.note, r.updated_at
    FROM public.supplier_rates r
   WHERE r.is_active
     AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role)
          OR public.has_role(auth.uid(), 'measurement_staff'::public.app_role))
   ORDER BY r.item_type, r.material NULLS FIRST, r.sell_rate;
$$;
REVOKE ALL ON FUNCTION public.rate_card() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_card() TO authenticated, service_role;

-- ── 3. Reorder signals ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_signals()
RETURNS TABLE (product_id uuid, sold_90d numeric, on_order numeric)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH sold AS (
    SELECT qi.product_id, sum(greatest(coalesce(qi.quantity, 0) - coalesce(qi.cancelled_qty, 0), 0)) AS qty
      FROM public.quotation_items qi
      JOIN public.quotations q ON q.id = qi.quotation_id
     WHERE qi.product_id IS NOT NULL AND q.deleted_at IS NULL
       AND coalesce(q.status, '') <> 'rejected'
       AND (coalesce(q.status, '') IN ('finalized', 'completed', 'delivered')
            OR coalesce(q.commercial_status, '') IN ('confirmed', 'payment_pending', 'closed', 'delivered'))
       AND coalesce(q.confirmed_at, q.created_at) >= now() - interval '90 days'
     GROUP BY qi.product_id
  ), ordered AS (
    SELECT coalesce(so.product_id, qi.product_id) AS product_id, sum(so.qty) AS qty
      FROM public.supplier_orders so
      LEFT JOIN public.quotation_items qi ON qi.id = so.quotation_item_id
     WHERE so.status = 'ordered' AND coalesce(so.product_id, qi.product_id) IS NOT NULL
     GROUP BY 1
  )
  SELECT coalesce(s.product_id, o.product_id), coalesce(s.qty, 0), coalesce(o.qty, 0)
    FROM sold s FULL JOIN ordered o ON o.product_id = s.product_id
   WHERE public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'staff'::public.app_role)
      OR public.has_role(auth.uid(), 'warehouse'::public.app_role);
$$;
REVOKE ALL ON FUNCTION public.reorder_signals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_signals() TO authenticated, service_role;
