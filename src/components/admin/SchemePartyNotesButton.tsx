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
import { Paperclip, StickyNote, Loader2, Trash2, Eye, Camera, FileText } from "lucide-react";
import { type AttachedNote } from "./FloatingNotesWindow";
import { notesWindow } from "./notesWindowStore";

type Props = {
  /** scheme_parties row UUID notes are attached to */
  partyId: string | null;
  className?: string;
};

/**
 * Notes + attach button for the Scheme Calculator. Mirrors the
 * quotation `AttachedNotesButton`: manage dialog for list/add/delete plus
 * the shared floating viewer window. Notes are anchored to the selected
 * party and visible only to admin/staff.
 */
export const SchemePartyNotesButton = ({ partyId, className }: Props) => {
  const { user, isOfficeStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<AttachedNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const reload = useCallback(async () => {
    if (!partyId) { setNotes([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("scheme_party_notes")
      .select("id, file_url, file_type, caption")
      .eq("party_id", partyId)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Couldn't load notes", description: error.message, variant: "destructive" });
    } else {
      const fresh = (data ?? []) as AttachedNote[];
      setNotes(fresh);
      notesWindow.setNotes(partyId, fresh);
    }
    setLoading(false);
  }, [partyId]);

  useEffect(() => { void reload(); }, [reload]);

  if (!isOfficeStaff) return null;

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!partyId) { toast({ title: "Select a party first", variant: "destructive" }); return; }
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const isPdf = /\.pdf$/i.test(f.name) || f.type === "application/pdf";
        let toUpload: Blob = f;
        if (!isPdf) toUpload = await compressImage(f);
        const safe = f.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const path = `scheme-notes/${partyId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("quotation-images")
          .upload(path, toUpload, { contentType: isPdf ? "application/pdf" : (toUpload as any).type || "image/jpeg" });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("quotation-images").getPublicUrl(path);
        const { error: insErr } = await supabase.from("scheme_party_notes").insert({
          party_id: partyId,
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
    const { error } = await supabase.from("scheme_party_notes").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    await reload();
    toast({ title: "Note removed" });
  };

  const count = notes.length;
  const disabled = !partyId;

  return (
    <>
      <Button
        type="button"
        variant={count > 0 ? "default" : "outline"}
        size="sm"
        onClick={() => {
          if (disabled) { toast({ title: "Select a party first" }); return; }
          setOpen(true);
        }}
        className={className}
        title={disabled ? "Pick a party to attach notes" : "Internal notes (admin/staff only)"}
      >
        <Paperclip className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Notes & Attach</span>
        {count > 0 && (
          <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{count}</Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-primary" />
              Party notes & attachments
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Photos of handwritten scheme pages, PDFs, references — kept per party and visible only to office staff.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              {loading && (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
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
                            {isPdf ? <FileText className="h-6 w-6 text-muted-foreground" /> : <img src={n.file_url} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{isPdf ? "PDF page" : "Photo"}</p>
                            {n.caption && <p className="truncate text-xs italic text-muted-foreground">"{n.caption}"</p>}
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
                      if (!partyId) return;
                      notesWindow.open(partyId, notes);
                      setOpen(false);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Open floating viewer
                  </Button>
                </>
              )}
            </div>

            <div className="space-y-2 rounded-md border border-border bg-card p-3">
              <Label className="text-xs">Add a new note</Label>
              <Input
                placeholder="Short caption (optional, e.g. 'Q3 dealer scheme sheet')"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={uploading}
              />
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                  <Camera className="h-4 w-4" />
                  Take / pick photo
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                    onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
                </label>
                <label className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                  <FileText className="h-4 w-4" />
                  Attach PDF / file
                  <input type="file" accept="application/pdf,image/*,.doc,.docx" multiple className="hidden"
                    onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
                </label>
              </div>
              {uploading && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SchemePartyNotesButton;