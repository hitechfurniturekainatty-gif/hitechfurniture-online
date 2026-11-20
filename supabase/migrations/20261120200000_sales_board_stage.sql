-- Sales Board stage (2026-11-20)
-- A lead's place on the Sales Board: new → contacted → showroom_visit → quotation, or lost.
-- ("Order" is not stored here: the board shows it from the linked quotation's status.)
-- Triggers keep the stage in step with status changes and logged calls, so every
-- existing screen (Leads page, Enquiries inbox, conversion RPC) stays correct.

ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new';
ALTER TABLE public.sales_leads DROP CONSTRAINT IF EXISTS sales_leads_stage_check;
ALTER TABLE public.sales_leads ADD CONSTRAINT sales_leads_stage_check
  CHECK (stage IN ('new','contacted','showroom_visit','quotation','lost'));

-- Status decides the stage where it must; otherwise the board's choice is kept.
CREATE OR REPLACE FUNCTION public.sales_leads_sync_stage()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'converted' OR NEW.converted_quotation_id IS NOT NULL THEN
    NEW.stage := 'quotation';
  ELSIF NEW.status IN ('lost','cancelled') THEN
    NEW.stage := 'lost';
  ELSIF NEW.stage IN ('lost','quotation') THEN
    -- Reopened lead: back to where it was before.
    NEW.stage := CASE WHEN NEW.contacted_at IS NOT NULL OR NEW.status = 'contacted' THEN 'contacted' ELSE 'new' END;
  ELSIF NEW.stage = 'new' AND (NEW.status = 'contacted' OR NEW.contacted_at IS NOT NULL) THEN
    NEW.stage := 'contacted';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sales_leads_sync_stage ON public.sales_leads;
CREATE TRIGGER trg_sales_leads_sync_stage
  BEFORE INSERT OR UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.sales_leads_sync_stage();

-- A logged "showroom visit" call moves an open lead to the Showroom visit column.
CREATE OR REPLACE FUNCTION public.sales_lead_followups_stage()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.outcome = 'showroom_visit' THEN
    UPDATE public.sales_leads SET stage = 'showroom_visit'
     WHERE id = NEW.lead_id AND status IN ('pending','contacted') AND stage IN ('new','contacted');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sales_lead_followups_stage ON public.sales_lead_followups;
CREATE TRIGGER trg_sales_lead_followups_stage
  AFTER INSERT ON public.sales_lead_followups
  FOR EACH ROW EXECUTE FUNCTION public.sales_lead_followups_stage();

-- Place existing leads (the trigger does the work on this no-op update).
UPDATE public.sales_leads SET stage = stage;
UPDATE public.sales_leads l SET stage = 'showroom_visit'
 WHERE l.status IN ('pending','contacted') AND l.stage IN ('new','contacted')
   AND EXISTS (SELECT 1 FROM public.sales_lead_followups f WHERE f.lead_id = l.id AND f.outcome = 'showroom_visit');

CREATE INDEX IF NOT EXISTS sales_leads_stage_idx ON public.sales_leads(stage) WHERE deleted_at IS NULL;
