-- Add editable terms & conditions to quotations
ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS terms text DEFAULT
'1. 50% advance payment required to confirm the order. Balance to be paid before/at delivery.
2. Delivery within 15-30 working days from advance receipt and final design approval.
3. Prices are valid for 15 days from quotation date.
4. GST as applicable will be charged extra (where shown).
5. Transportation and installation charges (if any) are extra unless specified.
6. Goods once sold will not be taken back or exchanged.
7. Any changes after order confirmation may attract additional charges.
8. Warranty as per manufacturer terms; does not cover misuse or natural wear.';