import { supabase } from "@/integrations/supabase/client";

export type TrashTable =
  | "quotations"
  | "job_work_orders"
  | "customer_services"
  | "customer_complaints"
  | "products"
  | "main_categories"
  | "sub_categories"
  | "workers"
  | "delivery_routes"
  | "trips"
  | "measurement_tasks";

/** Soft-delete a row by setting deleted_at + deleted_by. */
export async function softDelete(table: TrashTable, id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
    .eq("id", id);
}

/** Restore a previously soft-deleted row. */
export async function restoreFromTrash(table: TrashTable, id: string) {
  return supabase
    .from(table)
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id);
}

/** Permanently delete a row (admin-only at the RLS layer). */
export async function purgeRow(table: TrashTable, id: string) {
  return supabase.from(table).delete().eq("id", id);
}

export const TRASH_LABELS: Record<TrashTable, string> = {
  quotations: "Quotations / POs",
  job_work_orders: "Worker job assignments",
  customer_services: "Service requests",
  customer_complaints: "Warranty complaints",
  products: "Products",
  main_categories: "Main categories",
  sub_categories: "Sub categories",
  workers: "Workers",
  delivery_routes: "Delivery routes",
  trips: "Trips",
  measurement_tasks: "Measurement tasks",
};

/** Days until permanent purge (matches purge_old_trash function). */
export const TRASH_RETENTION_DAYS = 30;