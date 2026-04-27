
-- Revert bucket to public-read so existing stored public URLs keep working
-- across the app (PDFs, admin previews, worker portal). Writes remain locked
-- down by the role-gated INSERT/UPDATE/DELETE policies created previously.
UPDATE storage.buckets SET public = true WHERE id = 'quotation-images';

-- Replace the strict authenticated-only SELECT with a public read policy
-- scoped to this single bucket. URLs in this bucket are unguessable UUIDs,
-- and only signed-in staff can write new objects.
DROP POLICY IF EXISTS "quot_images_read_authenticated_staff" ON storage.objects;

CREATE POLICY "quot_images_public_read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'quotation-images');
