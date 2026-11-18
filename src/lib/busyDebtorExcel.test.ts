import { describe, expect, it } from "vitest";
import { parseBalance, parseDebtorSheets, planRefresh, splitAccount, accountKey } from "./busyDebtorExcel";

// All names, numbers and amounts below are invented test data.
describe("splitAccount", () => {
  it("takes a trailing 10-digit mobile out of the account text", () => {
    expect(splitAccount("26AB100 Test Customer Town 9000000001")).toEqual({ customer: "26AB100 Test Customer Town", phone: "9000000001" });
  });
  it("keeps the name when there is no mobile", () => {
    expect(splitAccount("Test Customer CC")).toEqual({ customer: "Test Customer CC", phone: null });
  });
  it("ignores a 10-digit number that is not a mobile", () => {
    expect(splitAccount("Test 1234567890").phone).toBeNull();
  });
});

describe("parseBalance", () => {
  it("reads numbers, commas, rupee sign and Dr/Cr", () => {
    expect(parseBalance(12500)).toBe(12500);
    expect(parseBalance("₹ 12,500.50 Dr")).toBe(12500.5);
    expect(parseBalance("800 Cr")).toBe(-800);
    expect(Number.isNaN(parseBalance("abc"))).toBe(true);
  });
});

describe("parseDebtorSheets", () => {
  const plain = { name: "Sheet1", rows: [["Account", "Balance"], ["A One 9000000001", 1000], ["B Two", 0]] };
  const withSales = {
    name: "Sheet2",
    rows: [["Account", "Sales Man", "Mobile No.", "Balance", "Notes"], ["A One 9000000001", "Sales A", " ", 1500, null], ["C Three", " ", "9000000003", 700, null], ["C Three", "Sales B", " ", 900, null], ["Total", "", "", 9999, ""], ["D Four", "", "", "n/a", ""]],
  };
  it("prefers the sheet that has a Sales Man column", () => {
    const p = parseDebtorSheets([plain, withSales]);
    expect(p.sheetName).toBe("Sheet2");
  });
  it("counts duplicates (last wins), skips totals and unreadable balances", () => {
    const p = parseDebtorSheets([withSales]);
    expect(p.duplicates).toBe(1);
    expect(p.skipped).toBe(1);
    expect(p.rows.map((r) => r.customer)).toEqual(["A One", "C Three"]);
    expect(p.rows.find((r) => r.customer === "C Three")).toMatchObject({ balance: 900, salesman: "Sales B" });
  });
  it("uses the Mobile column when the name has no number", () => {
    const p = parseDebtorSheets([{ name: "S", rows: [["Account", "Mobile No.", "Balance"], ["X Y", "9000000009", 10]] }]);
    expect(p.rows[0].phone).toBe("9000000009");
  });
  it("fails clearly when no sheet has the columns", () => {
    expect(() => parseDebtorSheets([{ name: "S", rows: [["Foo", "Bar"]] }])).toThrow(/Account/);
  });
});

describe("planRefresh", () => {
  const row = (name: string, balance: number, extra = {}) => ({ key: accountKey(name), customer: name, phone: null, salesman: null, balance, ...extra });
  it("inserts new, updates known, closes cleared and missing, never deletes", () => {
    const existing = [
      { id: "1", key: accountKey("Known"), phone: "9000000001", salesman: "Sales A", closed: false },
      { id: "2", key: accountKey("Cleared"), phone: null, salesman: null, closed: false },
      { id: "3", key: accountKey("Missing"), phone: null, salesman: null, closed: false },
      { id: "4", key: accountKey("Old closed"), phone: null, salesman: null, closed: true },
      { id: "5", key: accountKey("Back again"), phone: null, salesman: null, closed: true },
    ];
    const plan = planRefresh(existing, [row("Known", 500), row("Cleared", 0), row("New", 250), row("Back again", 300), row("Zero new", 0)]);
    expect(plan.inserts.map((r) => r.customer)).toEqual(["New"]);
    expect(plan.updates.map((r) => r.customer)).toEqual(["Known", "Back again"]);
    expect(plan.closeIds.sort()).toEqual(["2", "3"]);
    expect(plan.closedBecauseZero).toBe(1);
    expect(plan.closedBecauseMissing).toBe(1);
    expect(plan.totalBalance).toBe(1050);
  });
  it("keeps the stored phone and salesman when the file has none", () => {
    const plan = planRefresh([{ id: "1", key: accountKey("Known"), phone: "9000000001", salesman: "Sales A", closed: false }], [row("Known", 5)]);
    expect(plan.updates[0]).toMatchObject({ phone: "9000000001", salesman: "Sales A" });
    expect(plan.withoutPhone).toBe(0);
  });
});
