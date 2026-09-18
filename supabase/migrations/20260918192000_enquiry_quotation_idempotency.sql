-- Idempotency guards for enquiry -> quotation conversion and quotation item saves.
-- Existing enquiry leads already ARE quotation rows, so conversion must only
-- advance workflow metadata on the same primary key.

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS client_item_key uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotation_items_quotation_client_item_key_key'
      AND conrelid = 'public.quotation_items'::regclass
  ) THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT quotation_items_quotation_client_item_key_key
      UNIQUE (quotation_id, client_item_key);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.advance_enquiry_to_quotation(p_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row public.quotations%ROWTYPE;
BEGIN
  UPDATE public.quotations
  SET
    enquiry_contacted_at = COALESCE(enquiry_contacted_at, now()),
    commercial_status = CASE
      WHEN commercial_status IS NULL OR commercial_status = 'lead'
        THEN 'quote_preparation'
      ELSE commercial_status
    END
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'quotation_not_found'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'quotation_id', v_row.quotation_id,
    'commercial_status', v_row.commercial_status,
    'enquiry_contacted_at', v_row.enquiry_contacted_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.advance_enquiry_to_quotation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_enquiry_to_quotation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_enquiry_to_quotation(uuid) TO service_role;

COMMENT ON COLUMN public.quotation_items.client_item_key IS
  'Stable client-generated UUID used to make new quotation-item saves retry-safe.';

COMMENT ON FUNCTION public.advance_enquiry_to_quotation(uuid) IS
  'Idempotently advances an existing enquiry quotation row without creating or copying customer/item records.';
