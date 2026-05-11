# Interactive Help System

A consistent help layer across the app so a brand-new user (Admin, OPS, Worker, Delivery) can self-onboard without training.

## What you'll see

1. A small `?` help icon next to important input fields. Hover/tap shows a tooltip with a plain-English explanation and a real-world example.
2. A confirmation hint under primary action buttons explaining what happens next ("This will move the order to Production and notify workshop").
3. A floating **Help** button (bottom-right) on every admin page that opens a role-specific user manual drawer — written for the logged-in user's role only.
4. A first-login "Quick Tour" tooltip walkthrough that highlights the 3–5 most important controls on each main page.

## Scope of pages covered

- Admin Overview · Quotations list & editor · Measurement Tasks · Workers/Production · Warehouse/Logistics · My Trips · Staff Monitor · Pipeline Monitor

## Technical plan

### 1. Reusable primitives (`src/components/help/`)
- `HelpHint.tsx` — small `(?)` icon that wraps shadcn `Tooltip`. Props: `title`, `example?`, `side?`. Used inline next to `<Label>`.
- `ActionHint.tsx` — muted one-liner under a button explaining the consequence. Props: `children`, `tone?` (`info | warn | success`).
- `HelpDrawer.tsx` — shadcn `Sheet` opened by the floating button. Renders the manual for the **current role** with collapsible sections, search box, and "Open full guide" link to `/guide`.
- `HelpFab.tsx` — fixed bottom-right floating button (auto-hides on `/`, `/auth`, `/worker/*` public flows). Reads role from `useAuth`.
- `QuickTour.tsx` — lightweight coach-mark overlay (no extra deps; pure Tailwind + portal). Stores `seenTours` in `localStorage` so it shows once per page per user.

### 2. Content layer (`src/lib/help/`)
A single typed source of truth so copy is easy to update:
- `fieldHelp.ts` — `Record<string, { title: string; example?: string }>` keyed by stable field IDs (e.g. `quotation.party_phone`, `quotation.advance_amount`, `task.requirement`).
- `actionHelp.ts` — keyed by action ID (e.g. `quotation.submit_for_pricing`, `quotation.finalize`, `job.mark_done`, `trip.start`).
- `roleManuals.ts` — `Record<AppRole, ManualSection[]>` with sections like "Your daily workflow", "Common tasks", "FAQ". One manual each for `admin`, `staff` (OPS), `measurement_staff`, `worker` (production), `delivery`.
- `tours.ts` — per-route step lists (`{ selector, title, body }[]`).

### 3. Integration touchpoints

- Mount `HelpFab` once inside `AdminShell` so it appears on every admin page automatically. Worker portal gets its own simpler `WorkerHelpFab`.
- Wire `HelpHint` into the high-traffic forms first:
  - Create Quotation dialog (lead type, party fields, advance, GST, delivery route).
  - Quotation Editor (per-item routing, fulfillment route, measurement upload, finalize).
  - Measurement Task form (assigned_to, requirement).
  - Trip planner (route, driver, stops).
  - Staff create dialog (role select).
- Wire `ActionHint` under destructive / state-changing buttons: "Submit for Pricing", "Finalize", "Send to Production", "Mark Dispatched", "Start Trip", "Mark Delivered".
- Trigger `QuickTour` on first visit per route based on role.

### 4. Role-aware behavior
`HelpDrawer` reads role from `useAuth()` and renders only that role's manual. Admin sees a role-switcher inside the drawer to preview other roles' manuals (useful for training new hires).

### 5. Persistence
- Tour seen flags: `localStorage` key `help.tours.<routeKey>.<userId>`.
- "Don't show tips again" toggle inside the help drawer → `localStorage` key `help.tipsEnabled` (defaults true). When off, `HelpHint` icons are hidden but `ActionHint` lines stay (they're cheap and always useful).

### 6. Styling
- Uses existing semantic tokens (`muted-foreground`, `primary`, `border`).
- `HelpHint` icon: `lucide-react` `HelpCircle`, `h-3.5 w-3.5 text-muted-foreground hover:text-primary`.
- `HelpFab`: rounded-full primary button, 44px tap target, `shadow-product`.

### 7. Out of scope (this pass)
- Translations / i18n (English only for now).
- Video walkthroughs.
- Editing manual content from the admin UI (content lives in code; easy to update, no DB).

## Rollout order
1. Build primitives + content scaffolding.
2. Mount `HelpFab` + role manuals (immediate value, zero risk to existing forms).
3. Add `HelpHint` to Create Quotation + Quotation Editor (highest-traffic forms).
4. Add `ActionHint` to the 6 workflow-changing buttons.
5. Add `QuickTour` for Admin Overview, Quotations list, Worker portal, My Trips.

After step 2 the app is already significantly more self-explanatory; later steps are incremental.