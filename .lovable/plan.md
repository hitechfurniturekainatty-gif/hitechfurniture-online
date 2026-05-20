## 1. Bundle editor — better "Add items from catalog" UX

File: `src/pages/admin/AdminBundleEditor.tsx`

Replace the cramped single-row picker (`SearchableSelect + qty input + plus`) with a structured "Add from catalog" panel:

- **Catalog browser dialog** (button: "+ Add from catalog"):
  - Search by name/code, filter by main category & sub-category
  - Grid of product cards with thumbnail, name, code, MRP, stock badge
  - Multi-select with checkboxes; default qty = 1, editable inline before confirming
  - "Add selected" button inserts all picked items (skipping already-linked products) in one batch
- **Linked items list** redesign:
  - Card-style rows with product image thumbnail, name, code, stock, qty stepper (− / + buttons + input), and a remove icon
  - Drag-free reorder via Up/Down icons (uses `display_order`)
  - Shows running totals (item count, sum of MRP × qty) at top
  - Empty state with clear CTA

## 2. Quotation editor — bundle pick option

Files: `src/pages/admin/AdminQuotationEditor.tsx` (+ small additions)

- Load published bundles alongside products (one extra query, reuse existing loader)
- In the catalog picker dialog (currently products only), add a **"Bundles" tab** next to products:
  - Same card grid, shows bundle image, name, code, MRP, included items count
  - Picking a bundle inserts one quotation_items row with:
    - `bundle_id` set
    - `description` = bundle name
    - `catalog_text` = bundle code
    - `unit_price` = offer_price ?? mrp
    - `item_image_url` = main_image_url
- Row badge: show a "Bundle" badge (next to existing "Cat" badge) when `bundle_id` is set
- Inline "type to search" autocomplete on the row also includes bundles (prefixed with `[Bundle]`)

No DB changes needed — `quotation_items.bundle_id` and `product_bundles` already exist.

## Out of scope
- Editing bundle composition from inside the quotation row (kept separate; managed in bundle editor)
- Stock deduction logic (already handled by existing triggers)
