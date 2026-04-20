/**
 * Local-only "walking customer" draft persistence for the **New Quotation** form.
 *
 * Why localStorage (not Supabase):
 * - The row doesn't exist yet — there's nothing to save server-side.
 * - Sales staff often open the dialog, get interrupted (phone call, customer
 *   walks away), then come back. We want the typed party details to survive
 *   tab close, accidental back, or device sleep.
 *
 * One slot per device is enough — a sales rep is taking one customer at a
 * time. We expire drafts after 24h to avoid stale data lingering forever.
 */

const KEY = "mh_new_quotation_draft_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type NewQuotationDraft = {
  party_name: string;
  party_place: string;
  party_phone: string;
  savedAt: number;
};

export const saveNewQuotationDraft = (
  draft: Omit<NewQuotationDraft, "savedAt">
) => {
  // Don't persist completely empty form — avoids prompting on a fresh dialog.
  const empty =
    !draft.party_name.trim() &&
    !draft.party_place.trim() &&
    !draft.party_phone.trim();
  try {
    if (empty) {
      localStorage.removeItem(KEY);
      return;
    }
    const payload: NewQuotationDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage may be unavailable */
  }
};

export const loadNewQuotationDraft = (): NewQuotationDraft | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewQuotationDraft;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearNewQuotationDraft = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};