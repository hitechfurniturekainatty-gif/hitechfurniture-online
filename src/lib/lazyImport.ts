// Helper for dynamic imports that survive deploys.
//
// After a redeploy, any tab that was open before the deploy still references
// the OLD chunk hashes (e.g. `quotationPdf-0bFWOcC_.js`). When the user
// triggers a lazy import for the first time, the browser tries to fetch the
// old file from the CDN — which no longer exists — and throws:
//   "Failed to fetch dynamically imported module: …/quotationPdf-xxxx.js"
//
// We detect this specific class of error and force a one-time reload so the
// browser picks up the fresh index.html (and therefore the new chunk hashes).
// A sessionStorage flag prevents reload loops if the failure is genuine
// (e.g. user is fully offline).

const RELOAD_FLAG = "__lovable_chunk_reload__";

function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk \S+ failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

/**
 * Wrap a `() => import(...)` call. Retries once after a short delay (covers
 * transient network blips), and if the failure looks like a stale chunk from
 * a previous deploy, hard-reloads the page so the new asset manifest is used.
 */
export async function lazyImport<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    if (!isStaleChunkError(err)) throw err;

    // One quick retry in case it was a transient network/CDN hiccup.
    try {
      await new Promise((r) => setTimeout(r, 400));
      return await loader();
    } catch (err2) {
      if (!isStaleChunkError(err2)) throw err2;

      // Looks like a real stale-chunk situation. Reload once.
      if (typeof window !== "undefined") {
        const already = sessionStorage.getItem(RELOAD_FLAG);
        if (!already) {
          sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
          window.location.reload();
          // Give the reload a moment so the original caller's `catch` won't
          // surface a misleading toast before the page tears down.
          return await new Promise<T>(() => {});
        }
        // We already reloaded once this session; clear the flag so the next
        // genuine failure can try again later, then surface the error.
        sessionStorage.removeItem(RELOAD_FLAG);
      }
      throw err2;
    }
  }
}