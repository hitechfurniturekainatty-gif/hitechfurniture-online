DROP POLICY IF EXISTS "quotations public read" ON storage.objects;
CREATE POLICY "Quotation attachments for authorized staff" ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='quotations' AND (
 public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
 OR ((public.has_role(auth.uid(),'measurement_staff') OR public.has_role(auth.uid(),'warehouse') OR public.has_role(auth.uid(),'delivery') OR public.has_role(auth.uid(),'worker')) AND (
 owner_id=auth.uid()::text
 OR EXISTS (SELECT 1 FROM public.quotation_items i WHERE strpos(to_jsonb(i)::text, '/quotations/' || name)>0)
 OR EXISTS (SELECT 1 FROM public.job_work_orders j WHERE strpos(to_jsonb(j)::text, '/quotations/' || name)>0)
 OR (NOT public.has_role(auth.uid(),'worker') AND EXISTS (SELECT 1 FROM public.quotations q WHERE strpos(to_jsonb(q)::text, '/quotations/' || name)>0))
 ))));

