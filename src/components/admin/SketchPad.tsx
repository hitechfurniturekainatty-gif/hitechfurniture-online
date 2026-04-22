import { useCallback, useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "@/hooks/use-toast";
import {
  Pencil, Eraser, Type as TypeIcon, Undo2, Redo2, Trash2, Save, Loader2, X,
} from "lucide-react";

/**
 * Mobile-first hand-drawing pad for measurement sketches.
 *
 * Features
 * - Free-draw with finger / stylus / mouse (Fabric.js).
 * - Auto shape recognition: rough straight line → perfect line, rough circle → ellipse,
 *   rough rectangle → rectangle. Fires on every `path:created`.
 * - Pen color (Black / Red / Blue) and 3 thicknesses.
 * - Tap-to-add text labels (e.g., "233 cm") that can be dragged.
 * - Eraser tool (object selection + delete) for surgical cleanup.
 * - Undo / redo with JSON snapshot stack.
 * - Clear canvas.
 * - Export → flattens to PNG (2x DPR), uploads to `quotation-images/sketches`,
 *   returns the public URL via `onSave`.
 *
 * Loaded inside a full-screen dialog so the canvas can use all the screen
 * real estate on mobile.
 */

const PEN_COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#dc2626", label: "Red" },
  { value: "#2563eb", label: "Blue" },
];
const PEN_SIZES = [2, 4, 7];

type Tool = "draw" | "erase" | "text";

type SketchPadProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing PNG URL — loaded as a background so users can edit prior sketches. */
  initialUrl?: string | null;
  onSave: (publicUrl: string) => void;
};

/**
 * Detect if the just-drawn freehand path is essentially:
 * - a straight line (replace with perfect line)
 * - a closed circle/ellipse (replace with ellipse)
 * - a closed rectangle (replace with rect)
 * Otherwise leave the path as-is.
 */
function recognizeShape(canvas: fabric.Canvas, path: fabric.Path) {
  // Extract points from the SVG-style path data
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
  if (diag < 30) return false; // too small, leave alone

  const closed = Math.hypot(first.x - last.x, first.y - last.y) < diag * 0.25;
  const stroke = (path.stroke as string) || "#000000";
  const strokeWidth = path.strokeWidth ?? 3;

  // --- 1. Straight line: short, not closed, all points fit a line tightly ---
  if (!closed) {
    // Distance of each point from the chord first→last
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const len = Math.hypot(dx, dy) || 1;
    let maxDev = 0;
    for (const p of pts) {
      const dev = Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / len;
      if (dev > maxDev) maxDev = dev;
    }
    if (maxDev < Math.max(8, len * 0.05)) {
      const line = new fabric.Line([first.x, first.y, last.x, last.y], {
        stroke,
        strokeWidth,
        strokeLineCap: "round",
        selectable: true,
      });
      canvas.remove(path);
      canvas.add(line);
      canvas.requestRenderAll();
      return true;
    }
    return false;
  }

  // Closed shape — try rectangle, then ellipse
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Rectangle test: each point should be near one of the 4 edges of bbox
  let rectInliers = 0;
  const tol = Math.max(10, Math.min(w, h) * 0.1);
  for (const p of pts) {
    const dEdge = Math.min(
      Math.abs(p.x - minX),
      Math.abs(p.x - maxX),
      Math.abs(p.y - minY),
      Math.abs(p.y - maxY),
    );
    if (dEdge < tol) rectInliers++;
  }
  const rectScore = rectInliers / pts.length;

  // Ellipse test: each point should be near the bbox-fitted ellipse
  const rx = w / 2, ry = h / 2;
  let ellipseInliers = 0;
  for (const p of pts) {
    const v = ((p.x - cx) ** 2) / (rx * rx) + ((p.y - cy) ** 2) / (ry * ry);
    if (Math.abs(v - 1) < 0.35) ellipseInliers++;
  }
  const ellipseScore = ellipseInliers / pts.length;

  // Strong rectangle signal AND aspect within a reasonable range
  if (rectScore > 0.78 && rectScore >= ellipseScore) {
    const rect = new fabric.Rect({
      left: minX,
      top: minY,
      width: w,
      height: h,
      fill: "transparent",
      stroke,
      strokeWidth,
      strokeLineJoin: "round",
      selectable: true,
    });
    canvas.remove(path);
    canvas.add(rect);
    canvas.requestRenderAll();
    return true;
  }

  if (ellipseScore > 0.7) {
    const ellipse = new fabric.Ellipse({
      left: minX,
      top: minY,
      rx,
      ry,
      fill: "transparent",
      stroke,
      strokeWidth,
      selectable: true,
    });
    canvas.remove(path);
    canvas.add(ellipse);
    canvas.requestRenderAll();
    return true;
  }

  return false;
}

export const SketchPad = ({ open, onOpenChange, initialUrl, onSave }: SketchPadProps) => {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState<string>(PEN_COLORS[0].value);
  const [size, setSize] = useState<number>(PEN_SIZES[1]);
  const [saving, setSaving] = useState(false);

  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isRestoring = useRef(false);
  const [, force] = useState(0); // re-render to refresh undo/redo button enabled state

  // Snapshot current canvas state so we can undo to it later.
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
    if (!open || !canvasElRef.current || !wrapRef.current) return;
    const wrap = wrapRef.current;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: w,
      height: h,
      backgroundColor: "#ffffff",
      isDrawingMode: true,
      enableRetinaScaling: true,
      // Speed: skip multi-touch zoom/pan for now
      allowTouchScrolling: false,
    });
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = size;
    fabricRef.current = canvas;

    // Optional: load existing PNG as background so user can iterate
    if (initialUrl) {
      fabric.Image.fromURL(
        initialUrl,
        (img) => {
          if (!img) return;
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
          // Push initial snapshot AFTER background load so undo can return to it
          snapshot();
        },
        { crossOrigin: "anonymous" },
      );
    } else {
      snapshot();
    }

    // Path created → recognize shape → snapshot
    canvas.on("path:created", (e: fabric.IEvent & { path?: fabric.Path }) => {
      const path = e.path;
      if (path) recognizeShape(canvas, path);
      snapshot();
    });
    canvas.on("object:modified", () => snapshot());

    // Resize handling
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
      window.removeEventListener("resize", onResize);
      canvas.dispose();
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
    if (tool === "draw") {
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

  // Eraser: click an object to delete it
  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    const onDown = (e: fabric.IEvent) => {
      if (tool === "erase" && e.target) {
        c.remove(e.target);
        c.requestRenderAll();
        snapshot();
      } else if (tool === "text" && !e.target) {
        const p = c.getPointer(e.e);
        const text = new fabric.IText("Text", {
          left: p.x,
          top: p.y,
          fontSize: 22,
          fill: color,
          fontFamily: "Inter, system-ui, sans-serif",
          editable: true,
        });
        c.add(text);
        c.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        snapshot();
      }
    };
    c.on("mouse:down", onDown);
    return () => {
      c.off("mouse:down", onDown);
    };
  }, [tool, color, snapshot]);

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
      // Export at 2x DPR so the PNG looks crisp in the PDF
      const dataUrl = c.toDataURL({
        format: "png",
        multiplier: 2,
        quality: 1,
      });
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
        </DialogHeader>

        {/* Toolbar */}
        <div className="shrink-0 border-b border-border bg-muted/40 px-2 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Tools */}
            <div className="flex gap-1 rounded-md bg-background p-0.5 shadow-sm">
              <Button
                size="sm"
                variant={tool === "draw" ? "default" : "ghost"}
                className="h-9 px-2.5"
                onClick={() => setTool("draw")}
                title="Pen"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={tool === "text" ? "default" : "ghost"}
                className="h-9 px-2.5"
                onClick={() => setTool("text")}
                title="Text"
              >
                <TypeIcon className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={tool === "erase" ? "default" : "ghost"}
                className="h-9 px-2.5"
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
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
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
                  className={`flex h-7 w-7 items-center justify-center rounded-md border ${
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
                className="h-9 px-2.5"
                onClick={undo}
                disabled={undoStack.current.length <= 1}
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 px-2.5"
                onClick={redo}
                disabled={redoStack.current.length === 0}
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-9 px-2.5 text-destructive hover:text-destructive"
              onClick={clearAll}
              title="Clear all"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            Tip: rough lines snap straight, rough circles & rectangles auto-perfect.
          </p>
        </div>

        {/* Canvas area */}
        <div ref={wrapRef} className="relative flex-1 overflow-hidden bg-white touch-none">
          <canvas ref={canvasElRef} className="block" />
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
    </Dialog>
  );
};

export default SketchPad;