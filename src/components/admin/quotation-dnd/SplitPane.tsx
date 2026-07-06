import { ReactNode, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, GripVertical, GripHorizontal } from "lucide-react";

const RATIO_KEY = "quotation_dnd_split_ratio";
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
const DEFAULT_RATIO = 0.42;

const loadRatio = (): number => {
  const raw = Number(localStorage.getItem(RATIO_KEY));
  return raw >= MIN_RATIO && raw <= MAX_RATIO ? raw : DEFAULT_RATIO;
};

// Two-pane split view with a draggable divider and per-pane maximize toggle.
// Orientation flips to vertical below the `lg` breakpoint. All state
// (ratio, maximize) lives here and resets naturally on unmount, so callers
// can just stop rendering this to fully tear the split view down.
export const SplitPane = ({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(() =>
    typeof window !== "undefined" && window.innerWidth >= 1024 ? "horizontal" : "vertical",
  );
  const [ratio, setRatio] = useState<number>(() => loadRatio());
  const [maximized, setMaximized] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setOrientation(e.matches ? "horizontal" : "vertical");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem(RATIO_KEY, String(ratio));
  }, [ratio]);

  const updateRatioFromPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const raw =
      orientation === "horizontal"
        ? (clientX - rect.left) / rect.width
        : (clientY - rect.top) / rect.height;
    setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw)));
  };

  const onDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDividerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateRatioFromPoint(e.clientX, e.clientY);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // no-op — pointer capture may already be released
    }
  };

  const paneStyle = (pane: "left" | "right"): React.CSSProperties => {
    if (maximized) return {};
    const frac = pane === "left" ? ratio : 1 - ratio;
    return orientation === "horizontal" ? { width: `${frac * 100}%` } : { height: `${frac * 100}%` };
  };

  return (
    <div
      ref={containerRef}
      className={`flex h-[calc(100dvh-11rem)] min-h-[420px] w-full overflow-hidden rounded-xl border border-border bg-background ${
        orientation === "horizontal" ? "flex-row" : "flex-col"
      }`}
    >
      <div
        className={`relative min-h-0 min-w-0 overflow-hidden ${maximized === "right" ? "hidden" : ""} ${
          maximized === "left" ? "flex-1" : ""
        }`}
        style={paneStyle("left")}
      >
        <button
          type="button"
          onClick={() => setMaximized((m) => (m === "left" ? null : "left"))}
          className="absolute right-2 top-2 z-10 rounded-md border border-border bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur hover:bg-muted"
          aria-label={maximized === "left" ? `Restore split view` : `Maximize ${leftLabel}`}
          title={maximized === "left" ? "Restore split view" : `Maximize ${leftLabel}`}
        >
          {maximized === "left" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <div className="h-full overflow-y-auto">{left}</div>
      </div>

      {!maximized && (
        <div
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`shrink-0 touch-none bg-border transition-colors hover:bg-primary/40 ${
            orientation === "horizontal" ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"
          }`}
          role="separator"
          aria-orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
          aria-label="Resize catalog / form split"
        >
          <div
            className={`flex items-center justify-center text-muted-foreground ${
              orientation === "horizontal" ? "h-full w-1.5" : "h-1.5 w-full"
            }`}
          >
            {orientation === "horizontal" ? (
              <GripVertical className="h-4 w-4 -translate-x-1" />
            ) : (
              <GripHorizontal className="h-4 w-4 -translate-y-1" />
            )}
          </div>
        </div>
      )}

      <div
        className={`relative min-h-0 min-w-0 overflow-hidden ${maximized === "left" ? "hidden" : ""} ${
          maximized === "right" ? "flex-1" : ""
        }`}
        style={paneStyle("right")}
      >
        <button
          type="button"
          onClick={() => setMaximized((m) => (m === "right" ? null : "right"))}
          className="absolute right-2 top-2 z-10 rounded-md border border-border bg-background/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur hover:bg-muted"
          aria-label={maximized === "right" ? `Restore split view` : `Maximize ${rightLabel}`}
          title={maximized === "right" ? "Restore split view" : `Maximize ${rightLabel}`}
        >
          {maximized === "right" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <div className="h-full overflow-y-auto">{right}</div>
      </div>
    </div>
  );
};
