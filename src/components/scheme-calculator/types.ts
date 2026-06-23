// Shared types for the Vendor Scheme Dashboard.
export type Row = {
  id: string;
  item: string;
  qty: number;
  price: number;
  amountWithTax: number;
  mrp: number;
};

export type Invoice = {
  id: string;
  label: string;
  invoice_no?: string;
  date?: string;
  rows: Row[];
};

export type SchemeKind = "company" | "own" | "slab" | "bogo" | "percent" | "cashback" | "custom";
export type Period = "monthly" | "quarterly" | "yearly";

export type Party = {
  id: string;
  name: string;
  phone: string | null;
  place: string | null;
  address: string | null;
  gst_number: string | null;
  category: string | null;
  notes: string | null;
};

export type SchemeRow = {
  id: string;
  name: string;
  kind: SchemeKind;
  period: Period;
  config: any;
  is_active: boolean;
  notes: string | null;
};

export type TimelineMode = "monthly" | "quarterly" | "halfyearly" | "yearly";

export type VendorMonth = {
  id?: string;
  party_id: string;
  fy_year: number;
  month: number;
  scheme_kind: SchemeKind;
  scheme_config: any;
  purchases_text: string | null;
  purchase_rows: Row[];
  invoices: Invoice[];
};
