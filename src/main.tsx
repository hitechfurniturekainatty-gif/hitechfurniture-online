import { Buffer } from "buffer";
// Polyfill Buffer for browser libraries (e.g. @react-pdf/renderer image fetch)
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSessionTimeout } from "./lib/sessionTimeout";

// 24h hard session cap (security): sign user out + redirect after 24h of login.
initSessionTimeout();

createRoot(document.getElementById("root")!).render(<App />);
