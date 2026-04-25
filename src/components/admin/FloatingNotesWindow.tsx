import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  Minus,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  GripHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AttachedNote = {
  id: string;
  file_url: string;
  file_type: string; // 'image' | 'pdf'
  caption: string | null;
};

type Props = {
  open: boolean;
  notes: AttachedNote[];
  onClose: () => void;
};

/**
 * A draggable, resizable, zoomable floating overlay window that displays
 * staff-only attached notes (handwritten pages photographed by office staff).
 * - Drag the title bar to move
 * - Drag the bottom-right corner to resize
 * - Zoom in/out with the toolbar buttons or by scrolling inside
 * - Minimise to a small pill, restore by tapping it
 * - Close to dismiss the window entirely (parent controls re-opening)
 */
export const FloatingNotesWindow = ({ open, notes, onClose }: Props) => {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 24, y: 80 });
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 380, h: 460 });
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [index, setIndex] = useState(0);

  const dragRef = useRef<{ kind: "move" | "resize" | "pan" | null; startX: number; startY: number; baseX: number; baseY: number; baseW: number; baseH: number }>({
    kind: null,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    baseW: 0,
    baseH: 0,
  });

  // Keep window inside viewport on resize/orientation change.
  useEffect(() => {
    if (!open) return;
    const clamp = () => {
      setPos((p) => ({
        x: Math.min(Math.max(8, p.x), window.innerWidth - 80),
        y: Math.min(Math.max(8, p.y), window.innerHeight - 80),
      }));
    };
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open]);

  // Reset zoom/pan when switching note
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [index]);

  // Pointer-event drag handlers, used for both moving the window and resizing.
  const onPointerDown = useCallback(
    (kind: "move" | "resize" | "pan") => (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        kind,
        startX: e.clientX,
        startY: e.clientY,
        baseX: pos.x,
        baseY: pos.y,
        baseW: size.w,
        baseH: size.h,
      };
    },
    [pos.x, pos.y, size.w, size.h],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d.kind) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.kind === "move") {
        setPos({
          x: Math.min(Math.max(8, d.baseX + dx), window.innerWidth - 80),
          y: Math.min(Math.max(8, d.baseY + dy), window.innerHeight - 60),
        });
      } else if (d.kind === "resize") {
        setSize({
          w: Math.max(260, Math.min(window.innerWidth - 16, d.baseW + dx)),
          h: Math.max(220, Math.min(window.innerHeight - 16, d.baseH + dy)),
        });
      } else if (d.kind === "pan") {
        setPan((p) => ({ x: p.x + (e.clientX - d.startX) / zoom, y: p.y + (e.clientY - d.startY) / zoom }));
        // refresh start so panning is incremental
        dragRef.current = { ...d, startX: e.clientX, startY: e.clientY };
      }
    },
    [zoom],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = { kind: null, startX: 0, startY: 0, baseX: 0, baseY: 0, baseW: 0, baseH: 0 };
  }, []);

  if (!open || notes.length === 0) return null;

  const note = notes[Math.min(index, notes.length - 1)];
  const isPdf = note?.file_type === "pdf" || /\.pdf(\?.*)?$/i.test(note?.file_url ?? "");

  // Minimised pill state — single tap to restore
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed z-[60] flex items-center gap-2 rounded-full border border-primary/40 bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg"
        style={{ left: pos.x, top: pos.y }}
      >
        <StickyNote className="h-3.5 w-3.5" />
        Notes ({notes.length})
      </button>
    );
  }

  const winStyle: React.CSSProperties = maximized
    ? { left: 8, top: 8, width: "calc(100vw - 16px)", height: "calc(100dvh - 16px)" }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h };

  return (
    <div
      role="dialog"
      aria-label="Attached notes"
      className="fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl"
      style={winStyle}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Title bar (drag handle) */}
      <div
        className="flex shrink-0 cursor-move select-none items-center gap-1 border-b border-border bg-muted/70 px-2 py-1.5"
        onPointerDown={onPointerDown("move")}
      >
        <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
        <StickyNote className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-medium">
          Internal note {index + 1} / {notes.length}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(true)} aria-label="Minimise">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMaximized((m) => !m)}
            aria-label={maximized ? "Restore size" : "Maximise"}
          >
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIndex((i) => Math.min(notes.length - 1, i + 1))}
          disabled={index >= notes.length - 1}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-[3ch] text-center font-mono text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(5, z + 0.25))} aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content viewport */}
      <div
        className={cn(
          "relative flex-1 overflow-auto bg-muted/30",
          isPdf ? "" : "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={isPdf ? undefined : onPointerDown("pan")}
        onWheel={(e) => {
          // Ctrl/⌘+wheel to zoom, otherwise let it scroll naturally
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom((z) => Math.max(0.25, Math.min(5, z + (e.deltaY < 0 ? 0.1 : -0.1))));
          }
        }}
      >
        {isPdf ? (
          <iframe
            src={note.file_url}
            title={note.caption ?? "Attached PDF"}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex min-h-full w-full items-center justify-center p-2">
            <img
              src={note.file_url}
              alt={note.caption ?? "Attached note"}
              draggable={false}
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: "center center",
                transition: dragRef.current.kind === "pan" ? "none" : "transform 80ms linear",
                maxWidth: "none",
              }}
              className="select-none"
            />
          </div>
        )}
      </div>

      {/* Caption */}
      {note.caption && (
        <div className="shrink-0 border-t border-border bg-background px-3 py-1.5 text-xs italic text-muted-foreground">
          "{note.caption}"
        </div>
      )}

      {/* Resize handle */}
      {!maximized && (
        <div
          className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize"
          onPointerDown={onPointerDown("resize")}
          aria-label="Resize"
          style={{
            background:
              "linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%, hsl(var(--border)) 60%, transparent 60%, transparent 70%, hsl(var(--border)) 70%, hsl(var(--border)) 80%, transparent 80%)",
          }}
        />
      )}
    </div>
  );
};

export default FloatingNotesWindow;