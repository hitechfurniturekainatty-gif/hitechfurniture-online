import { useCallback, useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "@/hooks/use-toast";
import {
  Pencil, Eraser, Type as TypeIcon, Undo2, Redo2, Trash2, Save, Loader2, X, Ruler,
} from "lucide-react";

/**
 * Mobile-first hand-drawing pad for measurement sketches.
 *
 * Features
 * - Free-draw with finger / stylus / mouse (Fabric.js).
 * - Auto shape recognition: rough straight line → perfect line (axis-snapped),
 *   rough circle → ellipse, rough rectangle → rectangle.
 * - Optional "Dimension" mode: every drawn line becomes a measurement line with
 *   arrowheads at both ends and a clean digital "cm" label centered above it.
 * - Pen color (Black / Red / Blue) and 3 thicknesses.
 * - Text tool: tapping the canvas opens a focused input dialog so the mobile
 *   keyboard reliably appears; numeric inputs are auto-formatted as "<n> cm".
 * - Eraser tool (object selection + delete) for surgical cleanup.
 * - Undo / redo with JSON snapshot stack.
 * - Clear canvas.
 * - Export → flattens to PNG (2x DPR), uploads to `quotation-images/sketches`,
 *   returns the public URL via `onSave`.
 */

const PEN_COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#dc2626", label: "Red" },
  { value: "#2563eb", label: "Blue" },
];
const PEN_SIZES = [2, 4, 7];

type Tool = "draw" | "erase" | "text" | "dimension";

type SketchPadProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing PNG URL — loaded as a background so users can edit prior sketches. */
  initialUrl?: string | null;
  onSave: (publicUrl: string) => void;
};

/** Snap a near-axis angle to the closest 0/45/90 degree axis. */
function snapAngle(dx: number, dy: number) {
  const len = Math.hypot(dx, dy);
  if (len < 1) return { dx, dy, len };
  const angle = Math.atan2(dy, dx);
  const deg = (angle * 180) / Math.PI;
  // Snap if within 8° of a 45° step
  const step = 45;
  const snapped = Math.round(deg / step) * step;
  if (Math.abs(deg - snapped) < 8) {
    const r = (snapped * Math.PI) / 180;
    return { dx: Math.cos(r) * len, dy: Math.sin(r) * len, len };
  }
  return { dx, dy, len };
}

/** Build arrowhead triangles + an optional centered "cm" label for a line. */
function buildDimensionGroup(
  x1: number, y1: number, x2: number, y2: number,
  stroke: string, strokeWidth: number, label?: string,
): fabric.Object[] {
  const objs: fabric.Object[] = [];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux; // perpendicular unit

  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke, strokeWidth, strokeLineCap: "round", selectable: true,
  });
  objs.push(line);

  // Arrowheads (small filled triangles)
  const head = Math.max(8, strokeWidth * 3);
  const wing = head * 0.5;
  const mkHead = (hx: number, hy: number, sign: number) => {
    const bx = hx + ux * head * sign;
    const by = hy + uy * head * sign;
    const p1 = { x: bx + px * wing, y: by + py * wing };
    const p2 = { x: bx - px * wing, y: by - py * wing };
    return new fabric.Polygon(
      [{ x: hx, y: hy }, p1, p2],
      { fill: stroke, stroke, strokeWidth: 1, selectable: true },
    );
  };
  objs.push(mkHead(x1, y1, 1));   // arrow at start, pointing inward reverse
  objs.push(mkHead(x2, y2, -1));  // arrow at end

  if (label) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    // Place label slightly "above" the line (perpendicular offset)
    const off = 14 + strokeWidth;
    // Choose the side that goes "up" on screen
    const side = py < 0 ? 1 : -1;
    const lx = cx + px * off * side;
    const ly = cy + py * off * side;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Keep text upright (avoid upside-down)
    const textAngle = angle > 90 || angle < -90 ? angle + 180 : angle;
    const text = new fabric.Text(label, {
      left: lx,
      top: ly,
      fontSize: 16,
      fontWeight: "bold",
      fill: stroke,
      fontFamily: "Inter, system-ui, sans-serif",
      originX: "center",
      originY: "center",
      angle: textAngle,
      backgroundColor: "rgba(255,255,255,0.85)",
      selectable: true,
    });
    objs.push(text);
  }

  return objs;
}

/**
 * Detect if the just-drawn freehand path is essentially:
 * - a straight line (replace with perfect axis-snapped line + optional dimension)
 * - a closed circle/ellipse (replace with ellipse)
 * - a closed rectangle (replace with rect)
 */
function recognizeShape(
  canvas: fabric.Canvas,
  path: fabric.Path,
  opts: { dimension: boolean },
) {
  const pts: { x: number; y: number }[] = [];
  const data = (path.path as unknown as Array<(string | number)[]>) ?? [];
  for (const seg of data) {
    const cmd = seg[0];
    if (cmd === "M" || cmd === "L") {
      pts.push({ x: Number(seg[1]), y: Number(seg[2]) });
    } else if (cmd === "Q") {
      pts.push({ x: Number(seg[3]), y: Number(seg[4]) });
    }
  }
  if (pts.length < 4) return false;

  const first = pts[0];
  const last = pts[pts.length - 1];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const diag = Math.hypot(w, h);
  if (diag < 30) return false;

  const closed = Math.hypot(first.x - last.x, first.y - last.y) < diag * 0.25;
  const stroke = (path.stroke as string) || "#000000";
  const strokeWidth = path.strokeWidth ?? 3;

  // --- Straight line: not closed, points fit a chord tightly ---
  if (!closed) {
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const len = Math.hypot(dx, dy) || 1;
    let maxDev = 0;
    for (const p of pts) {
      const dev = Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / len;
      if (dev > maxDev) maxDev = dev;
    }
    if (maxDev < Math.max(8, len * 0.05)) {
      // Snap to nearest axis (0, 45, 90, …)
      const snapped = snapAngle(dx, dy);
      const x2 = first.x + snapped.dx;
      const y2 = first.y + snapped.dy;
      canvas.remove(path);
      if (opts.dimension) {
        // Use snapped length as the cm value (rounded), label centered.
        const label = `${Math.round(snapped.len)} cm`;
        const objs = buildDimensionGroup(first.x, first.y, x2, y2, stroke, strokeWidth, label);
        objs.forEach((o) => canvas.add(o));
      } else {
        const line = new fabric.Line([first.x, first.y, x2, y2], {
          stroke, strokeWidth, strokeLineCap: "round", selectable: true,
        });
        canvas.add(line);
      }
      canvas.requestRenderAll();
      return true;
    }
    return false;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  let rectInliers = 0;
  const tol = Math.max(10, Math.min(w, h) * 0.1);
  for (const p of pts) {
    const dEdge = Math.min(
      Math.abs(p.x - minX), Math.abs(p.x - maxX),
      Math.abs(p.y - minY), Math.abs(p.y - maxY),
    );
    if (dEdge < tol) rectInliers++;
  }
  const rectScore = rectInliers / pts.length;

  const rx = w / 2, ry = h / 2;
  let ellipseInliers = 0;
  for (const p of pts) {
    const v = ((p.x - cx) ** 2) / (rx * rx) + ((p.y - cy) ** 2) / (ry * ry);
    if (Math.abs(v - 1) < 0.35) ellipseInliers++;
  }
  const ellipseScore = ellipseInliers / pts.length;

  if (rectScore > 0.78 && rectScore >= ellipseScore) {
    const rect = new fabric.Rect({
      left: minX, top: minY, width: w, height: h,
      fill: "transparent", stroke, strokeWidth, strokeLineJoin: "round", selectable: true,
    });
    canvas.remove(path);
    canvas.add(rect);
    canvas.requestRenderAll();
    return true;
  }

  if (ellipseScore > 0.7) {
    const ellipse = new fabric.Ellipse({
      left: minX, top: minY, rx, ry,
      fill: "transparent", stroke, strokeWidth, selectable: true,
    });
    canvas.remove(path);
    canvas.add(ellipse);
    canvas.requestRenderAll();
    return true;
  }

  return false;
}

/** Auto-format a label: "180" → "180 cm"; existing units kept as-is. */
function formatLabel(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  // If already contains a unit (cm, mm, m, ft, in, "), keep as-is
  if (/[a-zA-Z"']/.test(v)) return v;
  // Pure numeric (or decimal) → append cm
  if (/^\d+(\.\d+)?$/.test(v)) return `${v} cm`;
  return v;
}

export const SketchPad = ({ open, onOpenChange, initialUrl, onSave }: SketchPadProps) => {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState<string>(PEN_COLORS[0].value);
  const [size, setSize] = useState<number>(PEN_SIZES[1]);
  const [saving, setSaving] = useState(false);

  // Inline text-input overlay state. We use a plain overlay (not a nested
  // Radix Dialog) so we can focus the <input> synchronously inside the same
  // touch gesture — that's what reliably opens the mobile keyboard.
  const [textOpen, setTextOpen] = useState(false);
  const [textValue, setTextValue] = useState("");
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const pendingPoint = useRef<{ x: number; y: number } | null>(null);

  // Refs so canvas event handlers always read the latest tool/color/size
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isRestoring = useRef(false);
  const [, force] = useState(0);

  const snapshot = useCallback(() => {
    if (!fabricRef.current || isRestoring.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    undoStack.current.push(json);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    force((n) => n + 1);
  }, []);

  // Initialize Fabric canvas when the dialog opens.
  useEffect(() => {
    if (!open) return;
    let canvas: fabric.Canvas | null = null;
    let raf = 0;
    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      const wrap = wrapRef.current;
      const el = canvasElRef.current;
      if (!wrap || !el) {
        raf = requestAnimationFrame(init);
        return;
      }
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 10 || h < 10) {
        raf = requestAnimationFrame(init);
        return;
      }

      canvas = new fabric.Canvas(el, {
        width: w,
        height: h,
        backgroundColor: "#ffffff",
        isDrawingMode: true,
        enableRetinaScaling: true,
        allowTouchScrolling: false,
      });
      canvas.freeDrawingBrush.color = colorRef.current;
      canvas.freeDrawingBrush.width = sizeRef.current;
      // Smoother strokes (less shakiness) — PencilBrush in fabric 5 supports decimate
      (canvas.freeDrawingBrush as unknown as { decimate?: number }).decimate = 4;
      fabricRef.current = canvas;

      if (initialUrl) {
        fabric.Image.fromURL(
          initialUrl,
          (img) => {
            if (!img || !canvas) return;
            const scale = Math.min(w / (img.width ?? w), h / (img.height ?? h), 1);
            img.set({
              scaleX: scale,
              scaleY: scale,
              selectable: false,
              evented: false,
              left: ((w - (img.width ?? w) * scale) / 2),
              top: ((h - (img.height ?? h) * scale) / 2),
            });
            canvas.add(img);
            canvas.sendToBack(img);
            canvas.requestRenderAll();
            snapshot();
          },
          { crossOrigin: "anonymous" },
        );
      } else {
        snapshot();
      }

      canvas.on("path:created", (e: fabric.IEvent & { path?: fabric.Path }) => {
        const path = e.path;
        if (path && canvas) {
          recognizeShape(canvas, path, { dimension: toolRef.current === "dimension" });
        }
        snapshot();
      });
      canvas.on("object:modified", () => snapshot());
    };

    raf = requestAnimationFrame(init);

    const onResize = () => {
      if (!wrapRef.current || !fabricRef.current) return;
      fabricRef.current.setDimensions({
        width: wrapRef.current.clientWidth,
        height: wrapRef.current.clientHeight,
      });
      fabricRef.current.requestRenderAll();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      if (canvas) canvas.dispose();
      fabricRef.current = null;
      undoStack.current = [];
      redoStack.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // React to tool / color / size changes
  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    if (tool === "draw" || tool === "dimension") {
      c.isDrawingMode = true;
      c.selection = false;
      c.freeDrawingBrush.color = color;
      c.freeDrawingBrush.width = size;
      c.defaultCursor = "crosshair";
    } else if (tool === "erase") {
      c.isDrawingMode = false;
      c.selection = true;
      c.defaultCursor = "not-allowed";
    } else {
      c.isDrawingMode = false;
      c.selection = true;
      c.defaultCursor = "text";
    }
  }, [tool, color, size]);

  // Eraser click + Text-tool tap → open inline text input (so mobile keyboard appears)
  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    const onDown = (e: fabric.IEvent) => {
      if (toolRef.current === "erase" && e.target) {
        c.remove(e.target);
        c.requestRenderAll();
        snapshot();
      } else if (toolRef.current === "text" && !e.target) {
        const p = c.getPointer(e.e);
        pendingPoint.current = { x: p.x, y: p.y };
        setTextValue("");
        setTextOpen(true);
        // CRITICAL for mobile: focus must happen inside the same user gesture
        // that started the touch, otherwise iOS/Android suppress the keyboard.
        // We grab focus on the next microtask once the input has rendered.
        requestAnimationFrame(() => {
          const el = textInputRef.current;
          if (el) {
            el.focus();
            try { el.click(); } catch { /* noop */ }
          }
        });
      }
    };
    c.on("mouse:down", onDown);
    return () => {
      c.off("mouse:down", onDown);
    };
  }, [snapshot]);

  const commitText = () => {
    const c = fabricRef.current;
    const pt = pendingPoint.current;
    const formatted = formatLabel(textValue);
    if (!c || !pt || !formatted) {
      setTextOpen(false);
      pendingPoint.current = null;
      return;
    }
    const text = new fabric.Text(formatted, {
      left: pt.x,
      top: pt.y,
      fontSize: 20,
      fontWeight: "bold",
      fill: colorRef.current,
      fontFamily: "Inter, system-ui, sans-serif",
      backgroundColor: "rgba(255,255,255,0.85)",
      originX: "center",
      originY: "center",
      selectable: true,
    });
    c.add(text);
    c.setActiveObject(text);
    c.requestRenderAll();
    snapshot();
    setTextOpen(false);
    pendingPoint.current = null;
  };

  const undo = () => {
    const c = fabricRef.current;
    if (!c || undoStack.current.length <= 1) return;
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);
    const prev = undoStack.current[undoStack.current.length - 1];
    isRestoring.current = true;
    c.loadFromJSON(prev, () => {
      c.requestRenderAll();
      isRestoring.current = false;
      force((n) => n + 1);
    });
  };

  const redo = () => {
    const c = fabricRef.current;
    if (!c || redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    isRestoring.current = true;
    c.loadFromJSON(next, () => {
      c.requestRenderAll();
      isRestoring.current = false;
      force((n) => n + 1);
    });
  };

  const clearAll = () => {
    const c = fabricRef.current;
    if (!c) return;
    c.clear();
    c.backgroundColor = "#ffffff";
    c.requestRenderAll();
    snapshot();
  };

  const handleSave = async () => {
    const c = fabricRef.current;
    if (!c) return;
    setSaving(true);
    try {
      const dataUrl = c.toDataURL({ format: "png", multiplier: 2, quality: 1 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `sketch-${Date.now()}.png`, { type: "image/png" });
      const compressed = await compressImage(file);
      const path = `sketches/${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage
        .from("quotation-images")
        .upload(path, compressed, {
          contentType: compressed.type || "image/png",
          upsert: false,
          cacheControl: "31536000, immutable",
        });
      if (error) {
        toast({ title: "Sketch upload failed", description: error.message, variant: "destructive" });
        return;
      }
      const { data } = supabase.storage.from("quotation-images").getPublicUrl(path);
      onSave(data.publicUrl);
      toast({ title: "Sketch saved" });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-[88vh] sm:max-w-4xl sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b border-border px-3 py-2 sm:px-4">
          <DialogTitle className="text-base">Measurement Sketch</DialogTitle>
          <DialogDescription className="sr-only">
            Draw measurements with finger, stylus, or mouse. Lines auto-snap to axes;
            in dimension mode, a clean cm label and arrowheads are added automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Canvas area */}
        <div ref={wrapRef} className="relative flex-1 overflow-hidden bg-white">
          <canvas ref={canvasElRef} className="block touch-none" />
        </div>

        {/* Bottom toolbar — easier to reach with thumbs on mobile */}
        <div className="shrink-0 border-t border-border bg-muted/40 px-2 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Tools */}
            <div className="flex gap-1 rounded-md bg-background p-0.5 shadow-sm">
              <Button
                size="sm"
                variant={tool === "draw" ? "default" : "ghost"}
                className="h-10 px-3"
                onClick={() => setTool("draw")}
                title="Pen"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={tool === "dimension" ? "default" : "ghost"}
                className="h-10 px-3"
                onClick={() => setTool("dimension")}
                title="Dimension line (auto arrows + cm)"
              >
                <Ruler className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={tool === "text" ? "default" : "ghost"}
                className="h-10 px-3"
                onClick={() => setTool("text")}
                title="Text"
              >
                <TypeIcon className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={tool === "erase" ? "default" : "ghost"}
                className="h-10 px-3"
                onClick={() => setTool("erase")}
                title="Erase (tap an object)"
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </div>

            {/* Colors */}
            <div className="flex gap-1 rounded-md bg-background p-1 shadow-sm">
              {PEN_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    color === c.value ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                  aria-label={c.label}
                  title={c.label}
                />
              ))}
            </div>

            {/* Pen size */}
            <div className="flex gap-1 rounded-md bg-background p-1 shadow-sm">
              {PEN_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                    size === s ? "border-foreground bg-muted" : "border-transparent"
                  }`}
                  aria-label={`Pen size ${s}`}
                  title={`Size ${s}`}
                >
                  <span
                    className="rounded-full bg-foreground"
                    style={{ width: s + 2, height: s + 2 }}
                  />
                </button>
              ))}
            </div>

            {/* History */}
            <div className="flex gap-1 rounded-md bg-background p-0.5 shadow-sm">
              <Button
                size="sm"
                variant="ghost"
                className="h-10 px-3"
                onMouseDown={(e) => { e.preventDefault(); undo(); }}
                onTouchStart={(e) => { e.preventDefault(); undo(); }}
                disabled={undoStack.current.length <= 1}
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-10 px-3"
                onMouseDown={(e) => { e.preventDefault(); redo(); }}
                onTouchStart={(e) => { e.preventDefault(); redo(); }}
                disabled={redoStack.current.length === 0}
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-10 px-3 text-destructive hover:text-destructive"
              onClick={clearAll}
              title="Clear all"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            Tip: lines auto-snap to nearest axis. Use the ruler tool to add arrowheads + cm label automatically.
          </p>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-3 py-2 sm:flex-row sm:px-4 sm:py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            <X className="mr-1.5 h-4 w-4" />Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save sketch
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Inline text-input overlay (NOT a nested Radix Dialog) so we can focus
          the input synchronously inside the touch gesture — required for the
          mobile keyboard to actually pop up reliably on iOS / Android. */}
      {textOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => { setTextOpen(false); pendingPoint.current = null; }}
        >
          <div
            className="w-full max-w-sm rounded-t-xl bg-background p-4 shadow-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-sm font-semibold">Add label</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Type a number (e.g. <strong>180</strong>) — we'll format it as <strong>180 cm</strong> automatically.
            </p>
            <input
              ref={textInputRef}
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitText(); } }}
              placeholder="e.g. 180 or 180 cm"
              inputMode="text"
              autoFocus
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setTextOpen(false); pendingPoint.current = null; }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={commitText}>Add</Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default SketchPad;
