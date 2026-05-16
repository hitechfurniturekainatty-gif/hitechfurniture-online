## Goal

Add a Bundle / Combo-Set module that lives alongside existing products (catalogs untouched), with automatic inventory deduction from linked items, and fix the two quotation UX issues (page jump on Add Item, and silent background auto-save).

---

## 1. Data model (new migration)

New tables:

- `product_bundles` — mirrors `products` shape:
  - `id`, `bundle_code` (unique), `name`, `description`, `main_category_id`, `sub_category_id`
  - `main_image_url`, `mrp`, `offer_price`, `cost_price` (admin-only via trigger like products)
  - `available_colors text[]`, `material`, `dimensions`
  - `is_featured`, `is_published`, `stock_status` (derived, see trigger)
  - `floor_display_order`, soft-delete fields, timestamps
- `bundle_items` — link table:
  - `bundle_id`, `product_id`, `quantity` (numeric, default 1), `display_order`
- `bundle_images` — extra gallery images (mirrors `product_images`)

Triggers / functions:

- `recompute_bundle_stock(bundle_id)` — sets `product_bundles.stock_status`:
  - `out_of_stock` if any linked product has `stock_status='out_of_stock'` OR `stock_quantity < required qty`
  - else `in_stock`
- AFTER UPDATE on `products.stock_quantity` / `stock_status` → recompute every bundle that contains it
- AFTER INSERT/UPDATE/DELETE on `bundle_items` → recompute that bundle
- `consume_bundle_stock(bundle_id, qty, reason)` SECURITY DEFINER:
  - inserts a `stock_movements` row for each linked product with `change_qty = -(quantity * qty)` → existing `apply_stock_movement` trigger does the deduction and stamps `resulting_stock`

Quotation hook (extends existing `quotation_items_check_completion` logic):

- Add optional `bundle_id uuid` column on `quotation_items` (nullable, no breaking changes — items can still be free-form or product-linked).
- When a quotation item with `bundle_id` flips `delivered_at` from null → set, call `consume_bundle_stock(bundle_id, quantity, 'bundle delivery')`.

RLS:

- `product_bundles` / `bundle_images`: public read where `is_published AND deleted_at IS NULL`; admin all. Staff/warehouse/etc. read same as products.
- `bundle_items`: public read; admin write. Cost price protected by trigger identical to `protect_cost_price`.

---

## 2. Admin UI

- New page **`/admin/bundles`** (`AdminBundles.tsx`) — list + create, mirrors `AdminProducts`. Sidebar entry under Inventory, admin-only.
- New editor **`/admin/bundles/:id`** (`AdminBundleEditor.tsx`):
  - Same fields as product editor (image, MRP, offer price, cost, colors, description, category, featured/published).
  - **"Linked Items" panel**: searchable product picker (reuse `SearchableSelect`), add rows with `qty`, reorder, remove. Shows each item's current stock + computed bundle availability.
  - Live bundle stock badge (in_stock / out_of_stock derived from linked items).
- App routes added in `App.tsx` behind `<AdminOnly>`.

---

## 3. Catalog integration (non-breaking)

- Public `Catalog.tsx` and `ProductDetail.tsx`: fetch bundles in parallel and merge into the grid under their `main_category_id` (e.g. "Bedroom Sets"). Cards reuse `ProductCard` via a thin adapter so existing product cards are unchanged.
- `StaffCatalog.tsx`: same merge; prices always visible.
- Global price-hide toggle (`homepage_settings.hide_public_prices`) is already respected in `ProductCard`; adapter passes the same flag — no change needed there.

---

## 4. Quotation editor: bundle support

- In `AdminQuotationEditor` product picker, add a "Bundles" tab (or a toggle in the existing searchable list) — selecting a bundle creates a `quotation_item` with `bundle_id`, description = bundle name, unit_price = bundle offer_price/mrp.
- No change to item math — bundle is one line item.

---

## 5. UX fixes (quotation editor)

**A. Zero-jump Add Item**

- Wrap the items list with a stable scroll container; when adding a new item, capture `scrollTop` before insert and restore it after render via `useLayoutEffect`. Prevent the new row's autofocus from calling `scrollIntoView` (the `scrollFocusedIntoView` helper currently centers on focus — switch it off for the editor or pass `block: 'nearest'`).
- Remove any `key`-change driven remount on add.

**B. Silent background auto-save**

- Add a debounced (800 ms) auto-save in `AdminQuotationEditor`:
  - Diff current form against last-saved snapshot; if dirty, `upsert` quotation + items in the background.
  - No toasts, no spinners that block input; tiny "Saved ·  HH:mm" indicator in header.
  - Cancel in-flight save on new edits (AbortController).
  - On unmount/route change, flush pending save synchronously.

---

## 6. Technical details

```text
product_bundles ──< bundle_items >── products
        │
        └──< bundle_images
quotation_items.bundle_id ──► product_bundles
```

- Stock derivation is pull-based (trigger updates `stock_status`) so existing read paths don't change.
- Deduction uses existing `stock_movements` pipeline → keeps audit trail intact.
- No edits to `products`, `product_variants`, or existing category tables — pure additive.

---

## Out of scope

- Per-variant (color) bundle linking — bundle links to product, not variant. Can add later.
- Partial bundle returns / reversals (uses standard stock movement adjustments).
