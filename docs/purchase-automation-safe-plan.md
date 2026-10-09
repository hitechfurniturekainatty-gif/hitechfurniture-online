# HITECH Purchase-to-Website Automation — Safe Implementation Plan

Status: design/audit only. No production data or live workflow writes authorized until backup and restore verification.

## Existing implementation findings
- React/Vite frontend; Supabase project hitech-furniture-db is the production backend.
- Admin routes already include products, product approval, inventory receiving and inventory ledger.
- `AdminProductApproval.tsx` supports `products` and `pending_catalog_items`; approval of a product sets `review_status=approved` and `is_published=true`.
- `AdminInventoryReceiving.tsx` currently matches by product name and can publish automatically. Do not reuse this direct publishing path for invoice automation.
- `stock_movements` insert is expected to update product stock through database logic. Confirm actual trigger and its transactional behavior before integration.
- Production tables include products, product_images, pending_catalog_items, stock_movements. Existing schema must be fully reviewed.

## Non-negotiable safeguards
1. Obtain independently restorable database AND Supabase Storage backup; verify restoration without overwriting production.
2. Never alter/delete existing products, customer records, invoice records, images, or stock directly during initial rollout.
3. No auto-publishing or stock movements before explicit admin approval.
4. Deduplicate at supplier + invoice identifier + normalized line identifier, and source file checksum; a retry must not increment stock twice.
5. Match products by supplier and exact normalized SKU first. Ambiguous or missing code goes to manual review. Never rely on fuzzy name alone for automatic stock changes.
6. Exclude narration/other expenses/freight rows from item unit cost; preserve invoice total and discrepancies for review.
7. MRP = ceil((unit_purchase_rate * 1.5)/10) * 10, using decimal arithmetic; rounding upward to nearest Rs 10.
8. Preserve original catalog images and provenance; image edits require approval and must not change furniture design. Only remove branding where authorized.
9. Keep supplier cost restricted to authorized staff. Enforce RLS and server-side authorization.
10. Preserve purchase invoice source, parsed values, original images, approval actor/time, posting ID, and full audit history.

## Target workflow
Google Drive supplier folder upload -> n8n ingest -> checksum and supplier identification -> invoice OCR/extraction -> line classification -> SKU/catalog/image match -> category suggestion -> pricing -> staging draft with confidence and original evidence -> admin edit/approve -> transactional idempotent product upsert and stock movement -> publish -> result and error log.

## Proposed database additions (NOT applied)
- purchase_intake_files: source file IDs, checksum, supplier, processing state.
- purchase_invoice_drafts: supplier, invoice number/date, document reference, parse state, review state.
- purchase_invoice_lines: line key, exact source text, parsed code, quantity, rate, line amount, category, image match and confidence.
- purchase_approval_events: actor, timestamp, field edits, decision, posting reference.
- purchase_postings: immutable idempotency key and stock movement/product linkage.
Use separate schema/tables; inspect existing supplier and invoice entities first to avoid duplicates.

## Acceptance tests
- Same invoice uploaded twice -> exactly one posting.
- Same supplier/SKU repeat purchase -> restock existing item, not duplicate.
- Different supplier same code -> no accidental merge.
- Narration/other expenses -> excluded from unit price.
- Rs 555 pre-round MRP -> Rs 560; Rs 550 -> Rs 550.
- Wrong image, low-confidence match, unreadable invoice -> review only.
- Reject -> no publication or stock update.
- Approval retry/network timeout -> exactly one stock movement.
- New product remains draft until approved.
- Backup/restore dry run succeeds before enabling any live writes.

## Rollout gates
Gate A: Read-only schema and trigger audit.
Gate B: Independently verified backups.
Gate C: Code and n8n implementation in isolated development context.
Gate D: Simulated test fixtures and manual QA.
Gate E: User-authorized production deployment, initially disabled/dry-run.

## Confirmed rollout scope — Phase 1 (9 October 2026)
Business owner confirmed: **deliver invoice-to-catalogue automation first**. BUSY is the current accounting software, but integration may be replaced later. **Do not implement or enable BUSY sales/purchase/returns synchronization in Phase 1.** No manual purchase/sales entry on the website.

Phase 1: supplier invoice and product photos through Telegram/Google Drive -> AI OCR with original document evidence -> supplier/invoice/line extraction -> exclude freight and non-merchandise -> exact supplier+SKU candidate matching -> image selection and suggested description/category -> configurable markup (initial default 50%) and round-up (initial default INR 10) -> admin review/edit/reject -> approved catalogue publish.

**Critical stock isolation:** Phase 1 is catalogue-only. Approval and publishing must NOT insert stock movements, increment stock, or set opening quantities based on OCR invoices. Preserve the extracted invoice quantity as review metadata for future reconciliation, not live available stock. Existing products' stock must remain unchanged. New products should not be advertised as in stock until a separately verified stock source is available. Keep purchase costs admin-only.

**Required implementation changes before Phase 1 release:**
- Remove/bypass n8n `stage_or_autoupdate_item` and `upsert_catalog_item` stock-writing paths; neither can be called in the Phase 1 catalogue publishing flow.
- Replace nontransactional website approval and receiving paths with a secure, idempotent **catalogue-only** approval/publish operation, gated by admin authorization and backed by an immutable approval audit.
- Preserve source file/checksum, supplier, invoice number, line number, original photos, selected images, AI suggestions, price inputs, and human edits; unique intake keys prevent duplicate products and review submissions.
- Product image matching is suggestion-only; manual correction and approval are required. Do not replace existing approved product imagery without explicit selection.
- Implement tests proving invoice upload, duplicate retry, approval retry, rejection, image mismatch, price calculation, and publishing **never change stock**.
- Confirm database and Storage backup/restore independently before any production schema/workflow modification. Deploy only after explicit authorization and a successful dry-run.

Phase 2 (deferred): source-agnostic connector interface with BUSY adapter first and future ERP adapters; import purchases (+), purchase returns (-), sales (-), sales returns (+ only when resellable), edits/cancellations/reversals; ledger, reconciliation, deduplication, source-of-truth rules, and alerting. A Phase 1 invoice must not be re-posted as a purchase when Phase 2 is enabled.

**Status:** scope confirmed; this section is a development specification, not a claim that production changes or end-to-end tests are complete.
