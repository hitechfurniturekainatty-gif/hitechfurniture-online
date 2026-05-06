import { useSyncExternalStore } from "react";
import type { AttachedNote } from "./FloatingNotesWindow";

/**
 * Tiny module-level store for the floating "internal notes" window.
 *
 * Why not local React state?
 *  - The window has to survive opening other dialogs (image picker, product
 *    gallery, sketch pad, etc.). When state lived inside `AttachedNotesButton`,
 *    those dialogs would steal focus / re-render the button and the window
 *    would feel like it "closed" or got stuck behind the new dialog.
 *  - Lifting it to a singleton + rendering once at the App root means the
 *    window persists across ANY in-app navigation/dialog and only closes when:
 *    (A) the user clicks the X on the window, or
 *    (B) the quotation save handler explicitly calls `close()`.
 */

type State = {
  open: boolean;
  quotationId: string | null;
  notes: AttachedNote[];
};

let state: State = { open: false, quotationId: null, notes: [] };
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const notesWindow = {
  open(quotationId: string, notes: AttachedNote[]) {
    state = { open: true, quotationId, notes };
    emit();
  },
  /** Update the notes list while the window stays open (e.g. after upload/delete). */
  setNotes(quotationId: string, notes: AttachedNote[]) {
    if (!state.open || state.quotationId !== quotationId) return;
    state = { ...state, notes };
    emit();
  },
  close() {
    if (!state.open) return;
    state = { open: false, quotationId: null, notes: [] };
    emit();
  },
  get() {
    return state;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useNotesWindow = () =>
  useSyncExternalStore(notesWindow.subscribe, notesWindow.get, notesWindow.get);