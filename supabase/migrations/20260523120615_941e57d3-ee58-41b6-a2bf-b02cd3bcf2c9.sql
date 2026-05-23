CREATE TABLE public.scheme_party_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.scheme_parties(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  caption text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheme_party_notes_party ON public.scheme_party_notes(party_id);

ALTER TABLE public.scheme_party_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view scheme party notes"
ON public.scheme_party_notes FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can insert scheme party notes"
ON public.scheme_party_notes FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can delete scheme party notes"
ON public.scheme_party_notes FOR DELETE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));