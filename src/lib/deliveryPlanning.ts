export type PlannedQuotation = {
  status: string | null;
  commercial_status: string | null;
  document_type: string | null;
  pipeline_stage: number | null;
  expected_delivery_date: string | null;
  salesperson_name?: string | null;
};

export const isOrderConfirmed = (q: PlannedQuotation) =>
  ["confirmed", "delivered", "payment_pending", "closed"].includes(q.commercial_status ?? "") ||
  ["finalized", "delivered", "completed"].includes(q.status ?? "");

// A delivery promise belongs on the planner even before order confirmation.
// This is visibility only: warehouse/dispatch authorization remains separate.
export const isDeliveryPlannable = (q: PlannedQuotation) => {
  if (q.document_type === "po" || /reject|cancel|void/i.test(`${q.status} ${q.commercial_status}`)) return false;
  if (q.salesperson_name === "Website Enquiry" && Number(q.pipeline_stage ?? 1) < 2 && !isOrderConfirmed(q)) return false;
  return !!q.expected_delivery_date || isOrderConfirmed(q) || Number(q.pipeline_stage ?? 0) >= 3;
};

export type DeliveryItem = { delivered_at: string | null };

// A completed trip may carry only part of an order. Prefer item evidence;
// retain the explicit quotation status for legacy orders without item rows.
export const isDeliveryComplete = (status: string | null, items: DeliveryItem[]) =>
  items.length > 0 ? items.every((item) => !!item.delivered_at) : status === "delivered";

export const indiaDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
