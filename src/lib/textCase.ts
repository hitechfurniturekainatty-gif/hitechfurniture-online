/**
 * Universal Title Case helper used across the app.
 *
 * Rule (per product spec): the first letter of every word is upper-case,
 * every other letter is lower-case. Sub-words split by hyphens, slashes,
 * apostrophes etc. are each capitalised independently so things like
 * "l-shape sofa" come out as "L-Shape Sofa".
 *
 * Examples:
 *   toTitleCase("DINING TABLE")  -> "Dining Table"
 *   toTitleCase("dining table")  -> "Dining Table"
 *   toTitleCase("l-shape sofa")  -> "L-Shape Sofa"
 *   toTitleCase("john's home")   -> "John's Home"
 */
export function toTitleCase(input: string | null | undefined): string {
  if (input == null) return "";
  const s = String(input);
  if (!s.trim()) return s;
  return s
    .toLowerCase()
    .replace(/([\p{L}\p{N}]+)/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/** Convenience: trim then title-case. Safe to call with empty values. */
export function titleCaseTrim(input: string | null | undefined): string {
  return toTitleCase((input ?? "").trim());
}