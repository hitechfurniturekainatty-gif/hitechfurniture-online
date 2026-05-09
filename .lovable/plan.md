# Workflow Pipeline Restructure — Plan

Restructure the app into a clean 5-stage pipeline with role-based access, a delivery-team view that hides money internals, and an admin monitoring dashboard.

## What's already in place
- `src/lib/quotationPipeline.ts` already maps DB state → 5 stages: Pricing → Sent → Production → Delivery → Delivered, with owners and color tones.
- `AdminPipelineMonitor` page renders stage cards + filterable list (already wired at `/admin/pipeline`).
- Tables exist: `measurement_tasks`, `quotations`, `job_work_orders`, `trips`, `trip_quotations`.
- Roles already in place: `admin`, `staff`, `measurement_staff`, `delivery`, plus workers.

So the foundation is there — this plan focuses on the **gaps**: delivery-team view, admin at-a-glance dashboard, and tightening stage transitions.

---

## 1. Stage transitions (mostly verify + small fixes)

| Stage | Trigger (already works?) | Action needed |
|---|---|---|
| 1 Measurement | `measurement_tasks` assigned, staff submits → creates `quotations` with `status='drafted'` + `submitted_for_pricing_at` | ✅ working — verify Submit-for-Pricing button on task page |
| 2 Quotation sent | Admin sets price + status → `finalized` | ✅ working |
| 3 Production | Advance recorded → `job_work_orders` created/assigned | ✅ working — confirm jobs auto-create when advance is taken |
| 4 Ready for delivery | All jobs `completed` → eligible for trip assignment | Add: auto-show in Trips "Unassigned" pool when jobs done |
| 5 Delivered | `trip_quotations.delivered_at` set → triggers status='delivered' | Add: "Mark Delivered" button on driver view writes both `delivered_at` and bumps `quotations.status='delivered'` |

## 2. Delivery Team — restricted mobile view

Current `AdminMyTrips` shows full quotation details. Build a **delivery-focused stop view**:

- New component `DeliveryStopCard` used inside `AdminMyTrips` and a new `/delivery` route gated by `delivery` role.
- Per stop, show ONLY:
  - Customer name (large)
  - 📞 Phone — `tel:` link (click to call), and WhatsApp shortcut
  - 📍 Address — opens in Google Maps
  - **Balance Amount** = `total - advance_amount` (computed client-side); fallback to `total` if no advance. Single bold figure, no GST/subtotal/discount shown.
  - Item count + "View items" expandable list (description + qty only — **no unit prices**).
  - "Mark as Delivered" button → confirm → write `trip_quotations.delivered_at = now()` and update parent quotation status.
- Hide pricing fields with role check (`delivery` and not `admin/staff` → mask).
- Mobile-first: large tap targets, sticky action bar, `text-base`+ on phones.

## 3. Admin At-a-Glance Dashboard

Add a compact summary block at the top of `AdminOverview` (or enhance `AdminPipelineMonitor`):

```text
[ Ongoing Measurements ]  [ Production ]  [ Waiting Delivery ]  [ Delivered Today ]  [ Delivered This Month ]
       12 (amber)              7 (orange)        4 (blue)             3 (green)            48 (green)
```

- Each card clickable → filters the pipeline view.
- Color coding via existing `stageToneClasses` (amber/violet/indigo/emerald) + add an "orange" production override per spec.
- Counts via 2 lightweight queries: count of `measurement_tasks` (pending), and the existing pipeline aggregation. Delivered counts use `trip_quotations.delivered_at` ranges (today / month).

## 4. Finalize Delivery flow

- "Mark as Delivered" (driver):
  1. `update trip_quotations set delivered_at = now() where id = ...`
  2. `update quotations set status='delivered' where id = ...`
  3. If all stops on the trip are delivered → `update trips set status='completed'`.
- Cash collected: read `total - advance_amount` for delivered quotations in admin reports — surface a "Collected today" tile next to "Delivered today".
- Delivered orders disappear from active driver list; remain visible in admin pipeline filtered by stage 5.

## 5. Role-based route gating

- Add `<DeliveryOnly>` wrapper (mirrors `AdminOnly`) for the `/delivery` route.
- Hide pricing UI in shared components when current user has `delivery` role and lacks `admin`/`staff`.

---

## Files to add
- `src/components/delivery/DeliveryStopCard.tsx`
- `src/components/delivery/DeliveryOnly.tsx`
- `src/pages/Delivery.tsx` (mobile-first driver dashboard)
- `src/components/admin/PipelineSummary.tsx` (at-a-glance tiles)

## Files to edit
- `src/App.tsx` — add `/delivery` route
- `src/pages/admin/AdminOverview.tsx` — embed `PipelineSummary`
- `src/pages/admin/AdminMyTrips.tsx` — swap to `DeliveryStopCard` for non-admins, add Mark-Delivered handler
- `src/pages/admin/AdminTrips.tsx` — show "Ready for delivery" pool (quotations whose all jobs completed and no trip yet)
- `src/lib/quotationPipeline.ts` — already correct; no change

## DB changes
None required. All needed columns exist (`trip_quotations.delivered_at`, `quotations.advance_amount/total/status`, `job_work_orders.status`).

## Out of scope (not in this iteration)
- Push notifications to delivery team
- Cash collection receipt PDF
- Driver signature capture (can add later)
