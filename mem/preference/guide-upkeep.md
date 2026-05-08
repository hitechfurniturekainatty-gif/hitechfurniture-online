---
name: guide-upkeep
description: Always update the in-app User Guide whenever app behaviour changes
type: preference
---
The user wants the in-app User Guide (/guide, rendered from `src/lib/guideContent.ts`) to be the living A-to-Z manual.

**How to apply on every change:**
1. After any UI/feature/field/workflow change, edit `src/lib/guideContent.ts`:
   - Update or add the relevant CHAPTER / SECTION.
   - For tables of fields, use the `fields: [{ name, purpose }]` array — UserGuide.tsx renders these as a 2-column table.
   - Append a new entry to the `changelog` chapter at the bottom (newest first).
   - Bump `APP_VERSION` (semver-ish) and set `GUIDE_LAST_UPDATED` to today.
2. Mention briefly in the chat reply that the guide was updated.

**Why:** User explicitly asked for an A-to-Z guide that stays current with every change.
