// Shared types for the Vendor Scheme Dashboard.
export type SchemeKind = "company" | "own" | "slab" | "bogo" | "percent" | "cashback" | "custom";
export type Period = "monthly" | "quarterly" | "yearly";

export type SchemeMatchMode = "exact" | "family";
export type SchemeItemRule = {
  id?: string;
  purchaseItem: string;
  matchMode: SchemeMatchMode;
  /** Family matching must be an explicit staff choice. */
  familyExplicit?: boolean;
  buyQty: number;
  freeQty: number;
  freeItem: string;
};

export type Row = {
  id: string;
  item: string;
  qty: number;
  price: number;
  amountWithTax: number;
  mrp: number;
  /** Legacy per-item scheme snapshot. New quantity schemes match from month/template item rules. */
  scheme_rule_id?: string;
  scheme_name?: string;
  scheme_kind?: SchemeKind;
  scheme_config?: any;
};

export type Invoice = {
  id: string;
  label: string;
  invoice_no?: string;
  date?: string;
  rows: Row[];
};

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

export type BenefitReceipt = {
  id: string;
  kind: "free_item" | "credit_note" | "cashback" | "discount";
  item?: string;
  qty?: number;
  amount?: number;
  /** Stable link for new item-based free receipts; old receipts remain supported by item name. */
  scheme_rule_key?: string;
  purchase_item?: string;
  free_item?: string;
  /** Value per free unit. Used to convert free goods into a financial benefit. */
  unit_value?: number;
  date?: string;
  reference?: string;
  note?: string;
};

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
  benefit_receipts?: BenefitReceipt[];
};
