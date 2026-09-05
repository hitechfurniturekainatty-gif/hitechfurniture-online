import type { Row } from "./types";

const HEADER_ALIASES = {
  item: ["item", "item name", "description", "particular", "particulars", "product", "product name", "model"],
  qty: ["qty", "quantity", "qnty", "pcs", "nos", "units"],
  price: ["rate", "unit rate", "unit price", "purchase price", "price", "taxable rate"],
  total: ["total", "amount", "net amount", "taxable value", "taxable amount", "line total", "gross amount", "value"],
};

const SKIP_RE = /^(s\.?\s*no|sr\.?\s*no|sl\.?|item|description|particulars?|product|total|sub[-\s]?total|grand[-\s]?total|gst|igst|cgst|sgst|tax|amount|invoice|date|vendor|party|qty|quantity|rate|price|mrp|unit|hsn|sac|round\s*off|freight|discount)\b/i;

function normalizeHeader(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

function cleanNumber(v: string): number {
  let s = String(v ?? "").trim();
  if (!s || /%/.test(s)) return NaN;
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[()₹$€£,\s]/g, "").replace(/[^0-9.\-]/g, "");
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s);
  return negative ? -Math.abs(n) : n;
}

function isNumber(v: string) { return Number.isFinite(cleanNumber(v)); }

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(line: string): "tab" | "pipe" | "csv" | "spaces" {
  if (line.includes("\t")) return "tab";
  if (line.includes("|")) return "pipe";
  if ((line.match(/,/g) || []).length >= 2) return "csv";
  return "spaces";
}

function splitLine(line: string, delimiter: ReturnType<typeof detectDelimiter>) {
  const cells = delimiter === "tab" ? line.split(/\t+/)
    : delimiter === "pipe" ? line.split(/\|+/)
    : delimiter === "csv" ? splitCsv(line)
    : line.split(/\s{2,}/);
  return cells.map((s) => s.trim()).filter(Boolean);
}

function headerIndex(cells: string[], aliases: string[]) {
  return cells.findIndex((c) => {
    const h = normalizeHeader(c);
    return aliases.some((a) => h === a || h.includes(a));
  });
}

function row(id: string, item: string, qty: number, price: number, total: number): Row {
  return { id, item: item.trim(), qty, price: Number.isFinite(price) ? price : (qty > 0 ? total / qty : 0), amountWithTax: total, mrp: 0 };
}

function parseWithHeader(lines: string[], headerLineIndex: number, delimiter: ReturnType<typeof detectDelimiter>): Row[] {
  const header = splitLine(lines[headerLineIndex], delimiter);
  const itemIdx = headerIndex(header, HEADER_ALIASES.item);
  const qtyIdx = headerIndex(header, HEADER_ALIASES.qty);
  const priceIdx = headerIndex(header, HEADER_ALIASES.price);
  const totalIdx = headerIndex(header, HEADER_ALIASES.total);
  if (itemIdx < 0 || qtyIdx < 0 || (priceIdx < 0 && totalIdx < 0)) return [];

  const out: Row[] = [];
  for (const line of lines.slice(headerLineIndex + 1)) {
    const cells = splitLine(line, delimiter);
    if (cells.length <= Math.max(itemIdx, qtyIdx, priceIdx, totalIdx)) continue;
    const item = cells[itemIdx]?.trim() || "";
    if (!item || SKIP_RE.test(item)) continue;
    const qty = cleanNumber(cells[qtyIdx]);
    const price = priceIdx >= 0 ? cleanNumber(cells[priceIdx]) : NaN;
    const total = totalIdx >= 0 ? cleanNumber(cells[totalIdx]) : (Number.isFinite(price) && Number.isFinite(qty) ? price * qty : NaN);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(total) || total < 0) continue;
    out.push(row(crypto.randomUUID(), item, qty, price, total));
  }
  return out;
}

function parseHeuristicLine(raw: string): Row | null {
  const delimiter = detectDelimiter(raw);
  let cells = splitLine(raw, delimiter);
  if (cells.length < 2 && delimiter === "spaces") cells = raw.trim().split(/\s+/);
  if (!cells.length) return null;

  // Common invoice software prefixes each line with serial no.; never treat it as quantity.
  if (cells.length >= 4 && /^\d+$/.test(cells[0]) && !isNumber(cells[1])) cells = cells.slice(1);

  const numeric = cells.map((v, i) => ({ i, n: cleanNumber(v), raw: v })).filter((x) => Number.isFinite(x.n));
  if (numeric.length < 2) return null;
  const totalTok = numeric[numeric.length - 1];

  // Quantity normally has at least one money-like number after it. Ignore obvious HSN/SAC codes.
  let qtyTok = numeric.find((x) => x.i > 0 && x.i < totalTok.i && Number.isInteger(x.n) && x.n > 0 && x.n < 100000);
  if (!qtyTok) qtyTok = numeric.find((x) => x.i > 0 && x.i < totalTok.i && x.n > 0 && x.n < 100000);
  if (!qtyTok) return null;

  let itemCells = cells.slice(0, qtyTok.i);
  // Remove serial/HSN-like numeric prefixes but keep model numbers embedded in product names.
  while (itemCells.length > 1 && /^\d{1,10}$/.test(itemCells[0])) itemCells = itemCells.slice(1);
  const item = itemCells.join(" ").trim();
  if (!item || SKIP_RE.test(item) || /^\d+$/.test(item)) return null;

  const between = numeric.filter((x) => x.i > qtyTok!.i && x.i < totalTok.i);
  const priceTok = between.find((x) => x.n >= 0);
  const qty = qtyTok.n;
  const total = totalTok.n;
  const price = priceTok?.n ?? (qty > 0 ? total / qty : NaN);
  if (!(qty > 0) || !(total >= 0) || !Number.isFinite(price)) return null;
  return row(crypto.randomUUID(), item, qty, price, total);
}

/** Robust invoice parser for copy/paste, CSV/Excel text and software exports. */
export function parseInvoiceText(text: string): Row[] {
  if (!text?.trim()) return [];
  const lines = text.replace(/\u00a0/g, " ").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Prefer header-aware parsing because exported invoices often contain HSN/GST/discount columns.
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const delimiter = detectDelimiter(lines[i]);
    const cells = splitLine(lines[i], delimiter);
    const hasItem = headerIndex(cells, HEADER_ALIASES.item) >= 0;
    const hasQty = headerIndex(cells, HEADER_ALIASES.qty) >= 0;
    if (hasItem && hasQty) {
      const parsed = parseWithHeader(lines, i, delimiter);
      if (parsed.length) return parsed;
    }
  }

  return lines.map(parseHeuristicLine).filter((r): r is Row => Boolean(r));
}
