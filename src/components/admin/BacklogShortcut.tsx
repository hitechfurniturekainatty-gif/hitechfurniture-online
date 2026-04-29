import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global keyboard shortcut to reach the hidden Backlog area.
 * Press Ctrl+Shift+B (or Cmd+Shift+B on macOS) anywhere in the app.
 */
export function BacklogShortcut() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        // Mark this as a deliberate entry so BacklogGate doesn't bounce us out.
        (window as any).__backlogIntent = Date.now();
        // replace: true so the PIN screen never appears in browser history.
        navigate("/admin/backlog", { replace: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  return null;
}
