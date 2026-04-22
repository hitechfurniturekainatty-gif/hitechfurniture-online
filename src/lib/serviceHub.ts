/**
 * Helpers for the Service & Complaint Hub.
 *
 * Two record types live in this module conceptually:
 * - customer_services (SV-XXX) — repair / renovation jobs from a customer's home
 * - customer_complaints (CP-XXX) — warranty issues for items already sold
 *
 * Both can be converted into a real Quotation (QT-XXX) when paid work is needed.
 */

export type ServiceStatus =
  | "pending"
  | "scheduled"
  | "technician_visited"
  | "converted"
  | "resolved"
  | "cancelled";

export type ComplaintStatus =
  | "pending"
  | "scheduled"
  | "technician_visited"
  | "resolved"
  | "cancelled";

export const SERVICE_STATUSES: ServiceStatus[] = [
  "pending",
  "scheduled",
  "technician_visited",
  "converted",
  "resolved",
  "cancelled",
];

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  "pending",
  "scheduled",
  "technician_visited",
  "resolved",
  "cancelled",
];

const LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  technician_visited: "Technician Visited",
  converted: "Converted to QT",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

export const serviceStatusLabel = (s: string) => LABELS[s] ?? s;
export const complaintStatusLabel = (s: string) => LABELS[s] ?? s;

export const statusVariant = (
  s: string,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (s) {
    case "resolved":
    case "converted":
      return "default";
    case "scheduled":
    case "technician_visited":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
};

/**
 * Quotation `service_type` values used by the hub:
 *  - "standard": ordinary customer quote (default)
 *  - "service": originated from a Customer Service record
 *  - "complaint-repair": paid repair generated from a Complaint
 */
export type QuotationServiceType = "standard" | "service" | "complaint-repair";

export const isServiceTypeQuotation = (t: string | null | undefined) =>
  t === "service" || t === "complaint-repair";

export const serviceTypeLabel = (t: string | null | undefined): string => {
  if (t === "service") return "Service Request";
  if (t === "complaint-repair") return "Complaint Repair";
  return "";
};