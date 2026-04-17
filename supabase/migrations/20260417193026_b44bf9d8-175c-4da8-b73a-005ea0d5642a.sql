
-- Quotations
CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id TEXT UNIQUE NOT NULL,
  party_name TEXT NOT NULL,
  party_place TEXT NOT NULL,
  party_phone TEXT,
  party_address TEXT,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  gst_percent NUMERIC NOT NULL DEFAULT 18,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  source_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotations_select" ON public.quotations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
  OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND created_by = auth.uid())
);
CREATE POLICY "quotations_insert" ON public.quotations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
  OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND created_by = auth.uid())
);
CREATE POLICY "quotations_update" ON public.quotations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
  OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND created_by = auth.uid() AND status = 'draft')
);
CREATE POLICY "quotations_delete" ON public.quotations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER tr_quotations_updated BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_quotations_status ON public.quotations(status);
CREATE INDEX idx_quotations_created_by ON public.quotations(created_by);

-- Quotation items
CREATE TABLE public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  item_image_url TEXT,
  measurement TEXT,
  measurement_image_url TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select" ON public.quotation_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND q.created_by = auth.uid())
  )
));
CREATE POLICY "items_insert" ON public.quotation_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND q.created_by = auth.uid() AND q.status = 'draft')
  )
));
CREATE POLICY "items_update" ON public.quotation_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND q.created_by = auth.uid() AND q.status = 'draft')
  )
));
CREATE POLICY "items_delete" ON public.quotation_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quotations q
  WHERE q.id = quotation_items.quotation_id AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR (public.has_role(auth.uid(), 'measurement_staff'::public.app_role) AND q.created_by = auth.uid() AND q.status = 'draft')
  )
));

-- Counter
CREATE TABLE public.quotation_counters (
  scope TEXT PRIMARY KEY,
  last_serial INT NOT NULL DEFAULT 0
);
ALTER TABLE public.quotation_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_quotation_id(_party TEXT, _place TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _scope TEXT; _next INT; _safe_party TEXT; _safe_place TEXT;
BEGIN
  _safe_party := regexp_replace(coalesce(_party,'NA'), '[^a-zA-Z0-9]+', '', 'g');
  _safe_place := regexp_replace(coalesce(_place,'NA'), '[^a-zA-Z0-9]+', '', 'g');
  IF length(_safe_party)=0 THEN _safe_party := 'NA'; END IF;
  IF length(_safe_place)=0 THEN _safe_place := 'NA'; END IF;
  _scope := lower(_safe_party || '-' || _safe_place);
  INSERT INTO public.quotation_counters(scope, last_serial) VALUES (_scope, 1)
  ON CONFLICT (scope) DO UPDATE SET last_serial = public.quotation_counters.last_serial + 1
  RETURNING last_serial INTO _next;
  RETURN initcap(_safe_party) || '-' || initcap(_safe_place) || '-' || lpad(_next::text, 3, '0');
END; $$;

-- Auto compute amount
CREATE OR REPLACE FUNCTION public.compute_item_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.amount := ROUND(COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0), 2);
  RETURN NEW;
END; $$;
CREATE TRIGGER tr_item_amount BEFORE INSERT OR UPDATE ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.compute_item_amount();

-- Recalc totals
CREATE OR REPLACE FUNCTION public.recalc_quotation_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _qid UUID; _sub NUMERIC; _gst NUMERIC; _pct NUMERIC;
BEGIN
  _qid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  SELECT COALESCE(SUM(quantity*unit_price),0) INTO _sub FROM public.quotation_items WHERE quotation_id = _qid;
  SELECT gst_percent INTO _pct FROM public.quotations WHERE id = _qid;
  _gst := ROUND(_sub * COALESCE(_pct,0) / 100, 2);
  UPDATE public.quotations SET subtotal = _sub, gst_amount = _gst, total = _sub + _gst WHERE id = _qid;
  RETURN NULL;
END; $$;
CREATE TRIGGER tr_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_quotation_totals();

CREATE OR REPLACE FUNCTION public.recalc_on_gst_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.gst_percent IS DISTINCT FROM OLD.gst_percent THEN
    NEW.gst_amount := ROUND(NEW.subtotal * COALESCE(NEW.gst_percent,0) / 100, 2);
    NEW.total := NEW.subtotal + NEW.gst_amount;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tr_quotation_gst BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.recalc_on_gst_change();
