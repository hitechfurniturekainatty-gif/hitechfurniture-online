import { Buffer } from "buffer";
// Polyfill Buffer for browser libraries (e.g. @react-pdf/renderer image fetch)
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSessionTimeout } from "./lib/sessionTimeout";

// 24h hard session cap (security): sign user out + redirect after 24h of login.
initSessionTimeout();

// After a deploy, the old index.html in the user's tab still references the
// PREVIOUS chunk hashes. Their lazy `import()` calls then 404 with
// "Failed to fetch dynamically imported module" and the screen goes blank.
// Force a one-shot hard reload so the browser fetches the new index.html.
const RELOAD_FLAG = "__chunk_reload_done__";
const isStaleChunkError = (msg: string) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    msg,
  );
const handleStaleChunk = (msg: string) => {
  if (!isStaleChunkError(msg)) return;
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // avoid reload loops
  sessionStorage.setItem(RELOAD_FLAG, "1");
  window.location.reload();
};
window.addEventListener("error", (e) => handleStaleChunk(e.message || ""));
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  const msg = typeof reason === "string" ? reason : reason?.message ?? "";
  handleStaleChunk(msg);
});
// Clear the guard once the app has successfully booted past first paint.
setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 10_000);

createRoot(document.getElementById("root")!).render(<App />);
