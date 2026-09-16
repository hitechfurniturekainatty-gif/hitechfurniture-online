# Staff diary

Entry: `/admin/diary`, linked from staff navigation and the worker portal.

- Personal notes are private to their owner, including from administrators.
- Admin-assigned instructions are visible to the recipient and admins. Recipients can acknowledge, pin, complete and reopen them, but cannot change the instruction or its dates.
- Completion archives the note; explicit deletion hides it. Neither action erases audit history.
- Dates and reminder times use Asia/Kolkata. Due reminders remain visible after missed logins. The app refreshes on focus and every minute while open; no operating-system push notification is promised.
- Private compressed photos are saved under `staff-diary/<note-id>/<random-id>.jpg`, with a 5 MB server limit per image. The UI allows up to ten images, JPG/PNG/WebP input, captions, signed previews, zoom and deletion. Notes must be saved before attaching images. HEIC must be converted first.

## Connected work

`staff_diary_tasks` is a security-invoker view over the signed-in user's assigned measurement tasks, quotation follow-ups, work orders (including service, complaint and installation jobs), and delivery trips. No task or completion status is copied into the diary. Existing RLS still applies. Work orders assigned only to external workers without a login cannot appear in an account's diary.

Connected cards open the original workflow, where its existing completion checks and photos apply. A diary checkbox does not bypass required measurements, delivery evidence or work-order status transitions. Source changes appear on the next refresh. Unassigned enquiries are not personal assignments and are not copied into every staff member's diary.

## Future WhatsApp / n8n activation

Both records in `staff_diary_integrations` are disabled. There is no scheduler, outbound network trigger, WhatsApp call or extra paid service in this change. The app does not expose a switch that could imply a provider has been configured.

The database foundation is:

- `staff_diary_notes`: stable ID, owner, due date, reminder timestamp, status, revision, created/updated timestamps.
- `staff_diary_events`: transactional note changes with an ordered event ID; no note bodies or image URLs in the audit payload.
- `staff_diary_notification_preferences`: per-user consent timestamp, number, timezone and default 10:00 digest time. Writes are service-only until a validated consent/settings endpoint is implemented.
- `staff_diary_delivery_log`: unique idempotency key and delivery/failure state, with service-only writes.

Activation requires a server-side sender, explicit staff consent, validation of the company's number/provider, template approval as applicable, and credentials stored as server secrets (never in `settings` or client code). n8n should call an authenticated server endpoint, not hold broad database privileges in browser code.

The sender must check integration flags and consent, query current pending records for each recipient, exclude deleted/completed/rescheduled work, and claim a unique recipient/date/channel digest key transactionally before sending. Queue claims need leases/retry state and provider reconciliation for ambiguous delivery failures; a unique key alone cannot guarantee exactly-once delivery over a network. Re-read authoritative source tasks before each send. Service-role access bypasses RLS, so explicitly constrain owner/assignee and enforce the original source-access rules. Avoid copying private images or full private note content into messages by default; link to the authenticated diary. Never send a public signed media URL as a task link.

## Validation

- `supabase/tests/staff_diary_permissions.sql`: transactional live-database tests using existing role identities; all notes, events and storage metadata are rolled back. Checks private notes/images against other staff and admins, assignment restrictions, immutable ownership, read/completion/undo, audit and invoker-view access.
- `src/lib/diary.test.ts`: Indian midnight, reminder timezone round-trip, overdue/history filters and cancellation of completed/deleted reminders.
- `src/pages/admin/AdminDiary.test.tsx`: UI filters, completion, early reminders, read-only assigned instructions and failure/retry state.

The initial migration and follow-up read grant were applied to project `ejxautrxbcemrncpzjyg`. The follow-up grant preserves its existing office/admin RLS.

Known repository baseline: `tsc --noEmit -p tsconfig.app.json` already fails in `WorkerPortal.tsx` and `AdminQuotationPreview.tsx` because old PDF call sites omit `customer_name`, `customer_place`, and `required_by`. Verified against unchanged commit `0f7bf00`; this change adds no TypeScript errors. The Vite production build succeeds.
