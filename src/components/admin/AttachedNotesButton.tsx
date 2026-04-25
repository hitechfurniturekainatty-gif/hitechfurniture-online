import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/imageCompression";
import { Plus, StickyNote, Loader2, Trash2, Eye, Camera, FileText } from "lucide-react";
import { FloatingNotesWindow, type AttachedNote } from "./FloatingNotesWindow";

type Props = {
  /** quotation/PO row UUID this note is attached to */
  quotationId: string;
  /** show "+ Notes" label on desktop; collapses to icon on mobile */
  className?: string;
};

/**
 * Floating "+" button that staff/admin can use to attach handwritten notes
 * (photos or PDFs of extra pages) to a quotation or purchase order.
 * - Click once → opens the manage dialog (list + add + delete).
 * - Click "View" on any note → opens the draggable floating window.
 * - Notes are visible only to admin/staff (RLS) and never end up on
 *   customer-facing PDFs or shared images. Workers cannot see them.
 */
export const AttachedNotesButton = ({ quotationId, className }: Props) => {
  const { user, isOfficeStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<AttachedNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [floatOpen, setFloatOpen] = useState(false);
  const [caption, setCaption] = useState("");

  const reload = useCallback(async () => {
    if (!quotationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("quotation_attached_notes")
      .select("id, file_url, file_type, caption")
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Couldn't load notes", description: error.message, variant: "destructive" });
    } else {
      setNotes((data ?? []) as AttachedNote[]);
    }
    setLoading(false);
  }, [quotationId]);

  // Pre-load count badge as soon as the button is mounted
  useEffect(() => {
    void reload();
  }, [reload]);

  // Hide entirely from non-staff (workers never see it)
  if (!isOfficeStaff) return null;

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const isPdf = /\.pdf$/i.test(f.name) || f.type === "application/pdf";
        let toUpload: Blob = f;
        if (!isPdf) {
          // Compress photo for storage savings; keeps handwriting readable
          toUpload = await compressImage(f);
        }
        const safe = f.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const path = `quotation-notes/${quotationId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("quotation-images")
          .upload(path, toUpload, { contentType: isPdf ? "application/pdf" : (toUpload as any).type || "image/jpeg" });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("quotation-images").getPublicUrl(path);
        const { error: insErr } = await supabase.from("quotation_attached_notes").insert({
          quotation_id: quotationId,
          file_url: pub.publicUrl,
          file_type: isPdf ? "pdf" : "image",
          caption: caption.trim() || null,
          created_by: user?.id ?? null,
        });
        if (insErr) throw insErr;
      }
      setCaption("");
      await reload();
      toast({ title: "Note attached", description: "Visible only to office staff" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? "Try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("quotation_attached_notes").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    await reload();
    toast({ title: "Note removed" });
  };

  const count = notes.length;

  return (
    <>
      <Button
        type="button"
        variant={count > 0 ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
        title="Internal notes (admin/staff only)"
      >
        <Plus className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Notes</span>
        {count > 0 && (
          <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
            {count}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-primary" />
              Internal notes
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Photos of handwritten pages, extra references — visible only to office staff. Never shown to customers or workers.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing list */}
            <div className="space-y-2">
              {loading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
              {!loading && notes.length === 0 && (
                <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  No notes yet. Add one below.
                </p>
              )}
              {!loading && notes.length > 0 && (
                <>
                  <div className="grid max-h-60 gap-2 overflow-y-auto pr-1">
                    {notes.map((n) => {
                      const isPdf = n.file_type === "pdf";
                      return (
                        <div key={n.id} className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-background">
                            {isPdf ? (
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            ) : (
                              <img src={n.file_url} alt="" className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{isPdf ? "PDF page" : "Photo"}</p>
                            {n.caption && (
                              <p className="truncate text-xs italic text-muted-foreground">"{n.caption}"</p>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(n.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      setFloatOpen(true);
                      setOpen(false);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Open floating viewer
                  </Button>
                </>
              )}
            </div>

            {/* Add new */}
            <div className="space-y-2 rounded-md border border-border bg-card p-3">
              <Label className="text-xs">Add a new note</Label>
              <Input
                placeholder="Short caption (optional, e.g. 'site sketch')"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={uploading}
              />
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                  <Camera className="h-4 w-4" />
                  Take / pick photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                    disabled={uploading}
                  />
                </label>
                <label className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                  <FileText className="h-4 w-4" />
                  Attach PDF
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                    disabled={uploading}
                  />
                </label>
              </div>
              {uploading && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading…
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FloatingNotesWindow
        open={floatOpen}
        notes={notes}
        onClose={() => setFloatOpen(false)}
      />
    </>
  );
};

export default AttachedNotesButton;