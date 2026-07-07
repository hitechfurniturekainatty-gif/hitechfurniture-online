-- Free-text "Description" field for a quotation item, separate from the
-- existing `description` column (which is actually the item NAME, typed
-- via the AutoSuggestInput at the top of each item card).
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS item_notes text;
