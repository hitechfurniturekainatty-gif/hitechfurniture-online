
-- 1) PROFILES: tighten SELECT to self + admin
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Profiles viewable by self or admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2) PRODUCTS: hide cost_price from anonymous visitors at the column-grant level
REVOKE SELECT (cost_price) ON public.products FROM anon;

-- 3) QUOTATION-IMAGES bucket: make private and restrict access
UPDATE storage.buckets SET public = false WHERE id = 'quotation-images';

-- Drop existing permissive policies for this bucket
DROP POLICY IF EXISTS "quot_images_read_by_path" ON storage.objects;
DROP POLICY IF EXISTS "quot_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "quot_images_update" ON storage.objects;
DROP POLICY IF EXISTS "quot_images_delete" ON storage.objects;

-- READ: only authenticated users with a real internal role
CREATE POLICY "quot_images_read_authenticated_staff"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'quotation-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'measurement_staff')
    OR public.has_role(auth.uid(), 'delivery')
    OR EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid() AND w.deleted_at IS NULL)
  )
);

-- INSERT: admin / staff / measurement_staff / workers only
CREATE POLICY "quot_images_insert_staff"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quotation-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'measurement_staff')
    OR EXISTS (SELECT 1 FROM public.workers w WHERE w.user_id = auth.uid() AND w.deleted_at IS NULL)
  )
);

-- UPDATE / DELETE: admin + staff
CREATE POLICY "quot_images_update_admin_staff"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'quotation-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
);

CREATE POLICY "quot_images_delete_admin_staff"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'quotation-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
);

-- 4) REALTIME: lock down channel subscriptions to admin/staff only
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Realtime authenticated staff only" ON realtime.messages;
CREATE POLICY "Realtime authenticated staff only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
);
