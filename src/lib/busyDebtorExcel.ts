// Pure helpers for the "Refresh from Busy Excel" receivables upload.
// No network and no Supabase here so the rules can be unit tested with fake data.

export type DebtorRow = {
  key: string; // normalised full Busy account text, unique per customer
  customer: string; // account text without the trailing phone number
  phone: string | null; // 10-digit mobile taken from the account text or Mobile column
  salesman: string | null;
  balance: number;
};

export type ParsedDebtors = {
  sheetName: string;
  rows: DebtorRow[];
  duplicates: number; // same account listed twice; the last one wins
  skipped: number; // rows with a name but no readable balance
};

export type ExistingReceivable = {
  id: string;
  key: string;
  phone: string | null;
  salesman: string | null;
  closed: boolean;
};

export type RefreshPlan = {
  inserts: DebtorRow[]; // new customers with a balance
  updates: DebtorRow[]; // known customers whose balance is refreshed (or reopened)
  closeIds: string[]; // known open customers now at zero or missing from the file
  closedBecauseZero: number;
  closedBecauseMissing: number;
  totalBalance: number;
  withoutPhone: number;
  withoutSalesman: number;
};

const cell = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const headerKey = (v: unknown) => cell(v).toLowerCase().replace(/[^a-z]/g, "");

export const accountKey = (account: string) => cell(account).toLowerCase();

const MOBILE = /^[6-9]\d{9}$/;

/** "25HK12001 Dr ajay bathery 9188131787" -> name without phone, plus the phone. */
export function splitAccount(account: string): { customer: string; phone: string | null } {
  const a = cell(account);
  const m = a.match(/(?:^|\s)(\+?91[\s-]?)?(\d{10})\s*$/);
  if (!m || !MOBILE.test(m[2])) return { customer: a, phone: null };
  return { customer: a.slice(0, m.index).trim() || a, phone: m[2] };
}

/** Accepts numbers or text such as "12,500", "₹ 12,500.50 Dr" or "800 Cr" (Cr = negative). */
export function parseBalance(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const t = cell(v);
  if (!t) return NaN;
  const credit = /\bcr\b\.?$/i.test(t);
  const n = parseFloat(t.replace(/[₹,\s]/g, "").replace(/(dr|cr)\.?$/i, ""));
  if (!Number.isFinite(n)) return NaN;
  return credit ? -Math.abs(n) : n;
}

type Sheet = { name: string; rows: unknown[][] };

function findHeader(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const keys = (rows[i] ?? []).map(headerKey);
    const account = keys.indexOf("account");
    const balance = keys.indexOf("balance");
    if (account < 0 || balance < 0) continue;
    return {
      row: i,
      account,
      balance,
      salesman: keys.findIndex((k) => k === "salesman" || k === "salesmen"),
      mobile: keys.findIndex((k) => k === "mobileno" || k === "mobile" || k === "phone" || k === "phoneno"),
    };
  }
  return null;
}

/** Picks the sheet that has Account + Balance (preferring one that also has Sales Man). */
export function parseDebtorSheets(sheets: Sheet[]): ParsedDebtors {
  const found = sheets
    .map((s) => ({ s, h: findHeader(s.rows) }))
    .filter((x): x is { s: Sheet; h: NonNullable<ReturnType<typeof findHeader>> } => !!x.h);
  if (found.length === 0) throw new Error("No sheet with 'Account' and 'Balance' columns was found.");
  const pick = found.find((x) => x.h.salesman >= 0) ?? found[0];
  const { s, h } = pick;

  const byKey = new Map<string, DebtorRow>();
  let duplicates = 0;
  let skipped = 0;
  for (const r of s.rows.slice(h.row + 1)) {
    const account = cell(r[h.account]);
    if (!account || /^(grand\s+)?total\b/i.test(account)) continue;
    const balance = parseBalance(r[h.balance]);
    if (Number.isNaN(balance)) { skipped++; continue; }
    const split = splitAccount(account);
    const mobileCell = h.mobile >= 0 ? cell(r[h.mobile]).replace(/\D/g, "").slice(-10) : "";
    const row: DebtorRow = {
      key: accountKey(account),
      customer: split.customer,
      phone: MOBILE.test(mobileCell) ? mobileCell : split.phone,
      salesman: h.salesman >= 0 ? cell(r[h.salesman]) || null : null,
      balance,
    };
    if (byKey.has(row.key)) duplicates++;
    byKey.set(row.key, row);
  }
  return { sheetName: s.name, rows: [...byKey.values()], duplicates, skipped };
}

/** Decide what a refresh will do. Nothing is ever deleted; cleared customers are closed. */
export function planRefresh(existing: ExistingReceivable[], parsed: DebtorRow[]): RefreshPlan {
  const known = new Map(existing.map((e) => [e.key, e]));
  const seen = new Set<string>();
  const inserts: DebtorRow[] = [];
  const updates: DebtorRow[] = [];
  const closeIds: string[] = [];
  let closedBecauseZero = 0;

  for (const row of parsed) {
    seen.add(row.key);
    const prev = known.get(row.key);
    if (row.balance > 0) {
      if (!prev) inserts.push(row);
      else updates.push({ ...row, phone: row.phone ?? prev.phone, salesman: row.salesman ?? prev.salesman });
    } else if (prev && !prev.closed) {
      closeIds.push(prev.id);
      closedBecauseZero++;
    }
  }
  let closedBecauseMissing = 0;
  for (const e of existing) {
    if (!seen.has(e.key) && !e.closed) {
      closeIds.push(e.id);
      closedBecauseMissing++;
    }
  }
  const live = [...inserts, ...updates];
  return {
    inserts,
    updates,
    closeIds,
    closedBecauseZero,
    closedBecauseMissing,
    totalBalance: live.reduce((s, r) => s + r.balance, 0),
    withoutPhone: live.filter((r) => !r.phone).length,
    withoutSalesman: live.filter((r) => !r.salesman).length,
  };
}
