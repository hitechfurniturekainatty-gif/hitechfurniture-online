## Goal
Connect existing quotation statuses + worker job statuses to the new 6-stage pipeline (Client Hub → Dimensions → OPS → Production → Warehouse → Logistics), so files transition automatically end-to-end. Restrict each staff role to their stage. Standardize cards to show Name / Place / Phone.

## 1. Status → Stage mapping (logic only, no schema change)

`src/lib/quotationPipeline.ts` already defines the 6 stages. Refine `computeStage` so it matches the spec exactly:

- `status='drafted'` and no `source_task_id` → **Stage 1 Client Hub**
- `source_task_id` set, measurement_task still `pending` / `in_progress` → **Stage 2 Dimensions**
- `submitted_for_pricing_at` set OR `status='active'` with no jobs → **Stage 3 OPS**
- `status='finalized'` (advance recorded) and `jobs_total=0` → **Stage 3 OPS** (auto-create job pending) — UI then shows "Ready for Production"
- `jobs_total>0` and not all completed → **Stage 4 Production**
- All jobs completed (or `jobs_in_warehouse>0`) and not dispatched → **Stage 5 Warehouse**
- `jobs_dispatched>0` OR `has_trip` OR `status='delivered'` → **Stage 6 Logistics**
- `status='rejected'` → archive (excluded from pipeline counts)

## 2. Automation triggers (frontend, no DB triggers)

- **Assign Dimensions** click in Client Hub: already creates a `measurement_tasks` row + sets `source_task_id`. Confirm flow keeps quotation `status='drafted'` so `computeStage` returns Dimensions.
- **Measurement submitted for pricing** (existing button): sets `submitted_for_pricing_at` → falls into OPS automatically.
- **Finalize quotation** (existing): on success, if no `job_work_orders` exist, the editor will auto-prompt "Assign to Production Unit" (link to assignment dialog). No silent insert — keeps human-in-the-loop but visible in OPS as "Ready for Production".
- **Worker marks job Completed**: existing `bump_job_status_updated_at` already fires. Add: when a job moves to `status='completed'`, set `warehouse_status='in_warehouse'` (client-side update inside `WorkerJobView` after the status update). Quotation now appears in Stage 5.
- **Trip created / job dispatched**: existing logistics flow already pushes to Stage 6.

## 3. Role-based dashboards

`useAuth` already exposes `isAdmin / isOfficeStaff / isMeasurementStaff / isDelivery / isWorker`. Make `/admin` (AdminOverview) role-aware:

- **admin** → full 6-stage grid (current view).
- **measurement_staff** → redirect to `/admin/my-work` (already shows their tasks). Hide sidebar items except My Work.
- **office staff (OPS)** → land on `/admin/quotations?stage=stage3` filtered to OPS by default. Sidebar limited to Client Hub / Quotations / Logistics.
- **delivery** → redirect to `/admin/my-trips` (existing).
- **worker** → already redirected to `/worker` portal.

Implementation: add a `roleHome` helper in `useAuth` and apply it in `AdminOverview` (early `<Navigate>`) and in `AdminShell` to filter sidebar entries.

## 4. UI consistency

- Every quotation/job/trip card across AdminQuotations, AdminMyWork, AdminWorkers, AdminLogistics, AdminMyTrips: ensure **Name • Phone • Place** is rendered (most already do; audit and patch the 1–2 missing cards).
- Apply pastel stage chips using existing `stageToneClasses`.
- Global rename pass: search for any remaining "Workers", "Manage Workers", "Assign Measurement" in user-visible strings and update.

## 5. Files to edit

- `src/lib/quotationPipeline.ts` — refine `computeStage` rules.
- `src/hooks/useAuth.ts` — add `roleHome`.
- `src/pages/admin/AdminOverview.tsx` — role-based redirect at top.
- `src/components/admin/AdminShell.tsx` — filter sidebar by role; finish rename pass.
- `src/pages/admin/AdminQuotations.tsx` — ensure default stage filter honors `?stage=…`; rejected excluded from "active".
- `src/pages/admin/AdminQuotationEditor.tsx` — after Finalize, prompt to assign Production.
- `src/pages/WorkerJobView.tsx` — when marking completed, also set `warehouse_status='in_warehouse'`.
- Card audit: `AdminMyWork.tsx`, `AdminMeasurementTasks.tsx`, `AdminLogistics.tsx`, `AdminMyTrips.tsx`, `AdminWorkers.tsx`.

## Out of scope
- No new DB tables/columns (existing schema covers everything).
- No edge function changes.
- Existing PIN/backlog flows untouched.