import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Crop as CropIcon, RotateCw, Square, RectangleHorizontal, RectangleVertical, Move } from "lucide-react";

/**
 * Reusable image crop dialog used by SingleImagePicker / MultiImagePicker.
 * - Lets staff crop & rotate before upload (perfect for messy phone shots).
 * - "Use as-is" skips cropping for fast workflow.
 * - Returns a new File (image/jpeg) which the caller uploads.
 */

const ASPECTS: { label: string; value: number | undefined; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "1:1", value: 1, icon: Square },
  { label: "4:3", value: 4 / 3, icon: RectangleHorizontal },
  { label: "3:4", value: 3 / 4, icon: RectangleVertical },
];

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

  const out = document.createElement("canvas");
  out.width = area.width;
  out.height = area.height;
  const octx = out.getContext("2d")!;
  octx.drawImage(rotCanvas, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

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
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (!src || !pixels || !file) return;
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-4 w-4" /> Crop image
          </DialogTitle>
        </DialogHeader>

        <div className="relative h-[55vh] w-full overflow-hidden rounded-md bg-muted">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onComplete}
              restrictPosition={false}
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {ASPECTS.map((a) => {
              const Icon = a.icon;
              const active = aspect === a.value;
              return (
                <Button
                  key={a.label}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setAspect(a.value)}
                >
                  <Icon className="mr-1 h-3.5 w-3.5" /> {a.label}
                </Button>
              );
            })}
            <Button type="button" size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateCw className="mr-1 h-3.5 w-3.5" /> Rotate
            </Button>
          </div>
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={useAsIs} disabled={busy}>
            Use as-is
          </Button>
          <Button type="button" onClick={apply} disabled={busy || !pixels}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CropIcon className="mr-1.5 h-3.5 w-3.5" />}
            Crop & upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};