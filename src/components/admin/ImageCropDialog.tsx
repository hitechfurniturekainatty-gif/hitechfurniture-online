import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Crop as CropIcon, RotateCw, Move, Maximize2 } from "lucide-react";

/**
 * Reusable image crop dialog used by SingleImagePicker / MultiImagePicker.
 * - Lets staff crop & rotate before upload (perfect for messy phone shots).
 * - "Use as-is" skips cropping for fast workflow.
 * - Returns a new File (image/jpeg) which the caller uploads.
 */

async function getCroppedFile(
  src: string,
  area: Area,
  rotation: number,
  fileName: string,
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const bBoxW = image.width * cos + image.height * sin;
  const bBoxH = image.width * sin + image.height * cos;

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = bBoxW;
  rotCanvas.height = bBoxH;
  const rctx = rotCanvas.getContext("2d")!;
  rctx.translate(bBoxW / 2, bBoxH / 2);
  rctx.rotate(radians);
  rctx.drawImage(image, -image.width / 2, -image.height / 2);

  // Clamp the requested crop to the rotated bitmap bounds. With manual mode
  // (restrictPosition={false}) react-easy-crop can return negative offsets or
  // sizes that overflow the image — drawing those produces a blank canvas.
  const sx = Math.max(0, Math.floor(area.x));
  const sy = Math.max(0, Math.floor(area.y));
  const sw = Math.max(1, Math.min(Math.floor(area.width), Math.floor(bBoxW - sx)));
  const sh = Math.max(1, Math.min(Math.floor(area.height), Math.floor(bBoxH - sy)));

  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const octx = out.getContext("2d")!;
  // White backdrop in case the source has transparency or the crop slightly
  // overflows after clamping.
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, sw, sh);
  octx.drawImage(rotCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob: Blob = await new Promise((res) => out.toBlob((b) => res(b!), "image/jpeg", 0.92));
  const safeName = fileName.replace(/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i, "") + "_cropped.jpg";
  return new File([blob], safeName, { type: "image/jpeg", lastModified: Date.now() });
}

export const ImageCropDialog = ({
  file,
  open,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect] = useState<number | undefined>(undefined);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  // Manual mode: free aspect + user-controlled crop box size (in screen px).
  const [manual, setManual] = useState(true);
  const [boxW, setBoxW] = useState(260);
  const [boxH, setBoxH] = useState(260);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  // Track stage size so manual sliders never exceed the visible area.
  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setStageSize({ w: r.width, h: r.height });
      setBoxW((w) => Math.min(w || r.width * 0.7, r.width - 16));
      setBoxH((h) => Math.min(h || r.height * 0.7, r.height - 16));
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [open]);

  // Build / refresh object URL whenever the source file changes.
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setSrc(u);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setPixels(null);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const onComplete = useCallback((_: Area, areaPixels: Area) => setPixels(areaPixels), []);

  const close = () => {
    onCancel();
  };

  const useAsIs = () => {
    if (!file) return;
    onConfirm(file);
  };

  const apply = async () => {
    if (!file) return;
    // If react-easy-crop hasn't fired onCropComplete yet (rare race on slow
    // devices), fall back to using the original file so the user is never
    // stuck with a disabled "Crop & upload" button.
    if (!src || !pixels) {
      onConfirm(file);
      return;
    }
    setBusy(true);
    try {
      const out = await getCroppedFile(src, pixels, rotation, file.name);
      onConfirm(out);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
            <CropIcon className="h-4 w-4" /> Crop image
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
        <div ref={stageRef} className="relative h-[45vh] w-full overflow-hidden rounded-md bg-muted sm:h-[55vh]">
          {src && (
            <>
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={manual ? undefined : aspect}
                cropSize={manual ? { width: boxW, height: boxH } : undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onComplete}
                restrictPosition={false}
              />
              {manual && stageSize.w > 0 && (
                <ResizeHandles
                  stageW={stageSize.w}
                  stageH={stageSize.h}
                  boxW={boxW}
                  boxH={boxH}
                  setBoxW={setBoxW}
                  setBoxH={setBoxH}
                />
              )}
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => setManual(true)}
            >
              <Move className="mr-1 h-3.5 w-3.5" /> Manual crop
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={useAsIs}
              disabled={busy}
            >
              <Maximize2 className="mr-1 h-3.5 w-3.5" /> Full attach
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateCw className="mr-1 h-3.5 w-3.5" /> Rotate
            </Button>
          </div>
          {manual && stageSize.w > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12">Width</span>
                <Slider
                  value={[boxW]}
                  min={40}
                  max={Math.max(40, stageSize.w - 16)}
                  step={1}
                  onValueChange={(v) => setBoxW(v[0])}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12">Height</span>
                <Slider
                  value={[boxH]}
                  min={40}
                  max={Math.max(40, stageSize.h - 16)}
                  step={1}
                  onValueChange={(v) => setBoxH(v[0])}
                  className="flex-1"
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-12">Zoom</span>
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
          </div>
        </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:gap-2 sm:px-6 sm:py-4">
          <Button type="button" variant="ghost" onClick={close} disabled={busy} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={useAsIs} disabled={busy} className="w-full sm:w-auto">
            Use as-is
          </Button>
          <Button type="button" onClick={apply} disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CropIcon className="mr-1.5 h-3.5 w-3.5" />}
            Crop & upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};