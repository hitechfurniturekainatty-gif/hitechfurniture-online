# Plan — Invoice-style Quotation Editor

## Goal
Replace the current stacked "card per item" entry UI with a structured invoice-style table that mirrors the saved Digital Preview, while preserving every existing feature (custom vs ready-stock, sketches, site photos, attachments, GST, advance, status pipeline, auto-save).

## Scope
- File: `src/pages/admin/AdminQuotationEditor.tsx` (items section only — header/footer kept as-is).
- New component: `src/components/admin/QuotationItemsTable.tsx` for the invoice grid.

## Out of scope
- Header form (party, dates, delivery) — untouched.
- Totals/GST/advance footer — untouched.
- Database, RLS, pricing math — untouched.

## New layout

```text
┌─ # ─┬─ Item / Description ──────┬─ Qty ─┬─ Rate ─┬─ Amount ─┬─ ⋯ ─┐
│  1  │ Sofa – 3 seater [img]     │   2   │ 18,000 │  36,000  │  ⋯  │
│     │ ↳ Measurement · Sketch    │       │        │          │     │
├─────┼───────────────────────────┼───────┼────────┼──────────┼─────┤
│  2  │ + Add item                │       │        │          │     │
└─────┴───────────────────────────┴───────┴────────┴──────────┴─────┘
```

- Each row is one `<tr>` with inline-editable cells (description, qty, rate). Amount auto-computes.
- Row-action menu (`⋯`) opens a side sheet with the advanced fields that don't fit a grid: item image, measurement, measurement image, catalog text/image, sketch, site photos, fulfillment route, dispatched/delivered toggles. Existing components reused as-is — no rewrites.
- Sub-row chips show which advanced fields are filled (e.g. "Sketch · 2 photos") so nothing is hidden.
- Mobile (<640px): table collapses to a compact 2-column card per row (description full width, qty × rate inline) but keeps the same DOM order so Enter-nav still works.

## Enter-key navigation
- Wrap the items table in a single container with `onKeyDown={handleEnterAsNext}`.
- Cells get `data-enter-skip` only for the row-menu button.
- Sequence per row: Description → Qty → Rate → next row's Description. After the last row's Rate, Enter focuses the "+ Add item" button, which on Enter creates a new row and focuses its Description.
- `handleEnterAsNext` already handles textareas correctly; description is kept as a single-line `<input>` in the grid, with a "details" textarea in the side sheet.

## Preview button
- Add a sticky "Preview" pill (top-right of the items section) that opens the existing `QuotationPdfPreviewSheet` (already imported) in a dialog. No new PDF code.
- Button is visible at all times on desktop; on mobile it floats above the bottom action bar.

## Migration approach
1. Build `QuotationItemsTable` as a drop-in replacement that consumes the same `items` state + `updateItem/addItem/removeItem/moveItem` handlers already in the editor.
2. Swap the current items section's JSX for `<QuotationItemsTable …/>`. No state shape changes.
3. Move the per-item advanced fields into a new `<QuotationItemDetailsSheet>` opened from the row menu (reuses the existing field components).
4. Verify auto-save, realtime sync, and PDF preview still work.

## Acceptance checklist
- [ ] Items render as a structured invoice grid that visually mirrors the saved preview.
- [ ] Enter moves Description → Qty → Rate → next row, then to "+ Add item".
- [ ] Preview button opens the live PDF preview in a popup.
- [ ] All existing per-item data (image, measurement, sketch, site photos, route, dispatch/deliver) remains editable via the row's details sheet.
- [ ] Silent auto-save, scroll-jump prevention, and realtime co-editing untouched.
- [ ] No DB changes.

## Risk
Medium — editor is 2,300 lines and tightly coupled. Mitigation: keep state/handlers identical, isolate UI changes into two new components, ship behind no flag but verify on a real quotation before announcing.

Reply "go" to proceed, or tell me what to adjust (e.g. keep description as a textarea, change the row-menu UX, skip the mobile collapse).
