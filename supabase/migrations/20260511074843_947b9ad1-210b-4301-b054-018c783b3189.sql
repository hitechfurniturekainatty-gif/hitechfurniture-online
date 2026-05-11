DROP POLICY IF EXISTS tasks_select ON public.measurement_tasks;
CREATE POLICY tasks_select ON public.measurement_tasks
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'staff'::app_role)
      OR (has_role(auth.uid(), 'measurement_staff'::app_role) AND (assigned_to = auth.uid() OR assigned_to IS NULL))
    )
    AND deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS tasks_update ON public.measurement_tasks;
CREATE POLICY tasks_update ON public.measurement_tasks
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR (has_role(auth.uid(), 'measurement_staff'::app_role) AND (assigned_to = auth.uid() OR assigned_to IS NULL))
);