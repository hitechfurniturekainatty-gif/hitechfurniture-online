// Centralised accent style mapping for the Overview "groups" panels.
// Each accent name resolves to a coherent set of section / icon / card
// classes so we never have to string-manipulate Tailwind utilities.
export type AccentKey = "emerald" | "sky" | "orange";

export const ACCENT_STYLES: Record<AccentKey, {
  /** Outer <section> tint (border + background). */
  section: string;
  /** Icon "chip" (border + background + text colour). */
  iconBox: string;
  /** Stand-alone text colour used for inline card icons. */
  iconText: string;
}> = {
  emerald: {
    section: "border-emerald-500/30 bg-emerald-500/5",
    iconBox: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    iconText: "text-emerald-600 dark:text-emerald-400",
  },
  sky: {
    section: "border-sky-500/30 bg-sky-500/5",
    iconBox: "border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400",
    iconText: "text-sky-600 dark:text-sky-400",
  },
  orange: {
    section: "border-orange-500/30 bg-orange-500/5",
    iconBox: "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400",
    iconText: "text-orange-600 dark:text-orange-400",
  },
};
