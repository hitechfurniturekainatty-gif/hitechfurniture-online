import { Buffer } from "buffer";
// Polyfill Buffer for browser libraries (e.g. @react-pdf/renderer image fetch)
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
