## Goal
Make the end-to-end quotation workflow stage-aware so each role sees only what they need, and fix two specific bugs:
- Delivery staff can't see assigned trips/jobs
- Warehouse staff can't see quotation details after login

Office/Admin keep full pricing access. Warehouse and Delivery never see unit prices, line totals, or itemized rates — only the fields they need to do their job, plus advance/balance for collection.

---

## 1. Dashboards filter to the user's stage

- **Warehouse Dashboard (`/admin/warehouse`)**
  - Already gated by role; fix the data fetch so warehouse users can read the quotations they need (currently RLS allows it, but the page filters out anything in `drafted` — confirm warehouse-stage quotations show up).
  - Add a clear list view grouped by quotation: header (quote #, party, place, status, advance paid / balance due) → item rows showing only Name, Quantity, Measurement, image, sketch — **no unit price, no line total, no subtotal/GST/total**.
  - Tap a quotation → opens a warehouse-only detail view (new lightweight route, or read-only mode of preview) that hides all pricing.

- **Delivery Dashboard (`/admin/my-trips`)**
  - Fix the assignment query so a delivery user sees trips where they are the assigned driver (today the join is missing or filtered out — verify and repair).
  - Trip detail shows: customer name/phone/address, delivery route, item checklist (name + qty + measurement), and a single "Balance to collect" amount derived from `total - advance_amount`. No item prices.

## 2. Price-gating in the shared editor/preview

- Add a small helper `useCanSeePrices()` (admin + office staff = true; warehouse/delivery/worker = false) and apply it in:
  - `AdminQuotationEditor` — hide Rate, Amount, Subtotal, GST, Discount, Total columns/rows when false (already partly guarded by `canEditPrice`; extend to *display*).
  - `AdminQuotationPreview` — hide the same columns in mobile cards and desktop table; replace totals block with an "Advance / Balance" summary for warehouse + delivery.
  - `AdminWarehouse` row card — drop price chips.

## 3. Bug fixes

- **Warehouse can't see details**: verify the `quotations_select_warehouse` RLS policy is active (it exists in the schema). The page-level filter `q.status !== "drafted"` was excluding warehouse-stage rows that still carried the `finalized` status — relax to "any non-deleted quotation that has at least one non-delivered item once a job has reached warehouse_status != 'none' OR pipeline_stage >= 5".
- **Delivery can't see jobs/workers**: the `/admin/my-trips` query needs to match trips by the logged-in user's `auth.uid()` against the trip's driver/assigned user column. Confirm column name and re-add the filter. Also expose the trip's quotations + items (read-only, price-free).

## 4. Auth / credentials

Each staff member already has a unique login (email+password or phone+PIN via `WorkerLogin`). No change to credentials; just make sure new warehouse/delivery accounts created via the Staff Management page assign the right role so the dashboards above light up automatically.

## Files to change

- `src/hooks/useAuth.ts` — export `canSeePrices` flag.
- `src/pages/admin/AdminWarehouse.tsx` — relax filter, strip prices, add per-quote grouping.
- `src/pages/admin/AdminMyTrips.tsx` — fix driver filter, render price-free trip detail.
- `src/pages/admin/AdminQuotationEditor.tsx` — gate price columns on `canSeePrices`.
- `src/pages/admin/AdminQuotationPreview.tsx` — gate price columns + show advance/balance summary for warehouse/delivery.
- (Possibly) a new `src/pages/admin/WarehouseQuotationView.tsx` for the read-only price-free detail.

## Technical notes

- No schema changes required — `quotations_select_warehouse` and `items_select_warehouse` policies already exist; we just need to use them correctly and stop the page-level over-filtering.
- "Balance due" = `total - advance_amount` (never expose `subtotal` to warehouse/delivery).
- All price-gating is UI-layer. Workers still can't *edit* prices because RLS forbids it; we're only ensuring they can't *see* the numbers either.
