import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, TrendingUp, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DownloadShareMenu } from "@/components/admin/DownloadShareMenu";
import { downloadBlob } from "@/lib/downloadBlob";
import { shareFilesNative } from "@/lib/nativeShare";

import { Stat } from "@/components/scheme-calculator/Stat";
import { ProgressRing } from "@/components/scheme-calculator/ProgressRing";
import { MonthBlock } from "@/components/scheme-calculator/MonthBlock";
import { AggregatedView } from "@/components/scheme-calculator/AggregatedView";
import { PartiesTab } from "@/components/scheme-calculator/PartiesTab";
import { SchemesTab } from "@/components/scheme-calculator/SchemesTab";
import {
  FY_MONTHS,
  MONTH_NAME,
  aggregateRowsByItem,
  computeAchievementPct,
  computeFreeReport,
  currentFy,
  defaultConfig,
  fmt,
  fyCalendarYear,
} from "@/components/scheme-calculator/utils";
import type { Invoice, Party, Row, SchemeRow, TimelineMode, VendorMonth } from "@/components/scheme-calculator/types";

const AdminSchemeCalculator = () => {
  const [tab, setTab] = useState<"calc" | "parties" | "schemes">("calc");

  const [parties, setParties] = useState<Party[]>([]);
  const [savedSchemes, setSavedSchemes] = useState<SchemeRow[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [fy, setFy] = useState<number>(currentFy());
  const [mode, setMode] = useState<TimelineMode>("monthly");
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [months, setMonths] = useState<VendorMonth[]>([]);
  const [loading, setLoading] = useState(false);
  const [customFys, setCustomFys] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("scheme_custom_fys") || "[]"); } catch { return []; }
  });

  const fyOptions = useMemo(() => {
    const base = new Set<number>([currentFy() - 2, currentFy() - 1, currentFy(), currentFy() + 1]);
    customFys.forEach((y) => base.add(y));
    base.add(fy);
    return Array.from(base).sort((a, b) => b - a);
  }, [customFys, fy]);

  const addCustomFy = () => {
    const input = window.prompt("Enter the starting year of the Financial Year (e.g. 2024 for FY 2024–25):");
    if (!input) return;
    const y = parseInt(input.trim(), 10);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      toast({ title: "Invalid year", description: "Enter a 4-digit year between 2000 and 2100.", variant: "destructive" });
      return;
    }
    const next = Array.from(new Set([...customFys, y])).sort((a, b) => b - a);
    setCustomFys(next);
    localStorage.setItem("scheme_custom_fys", JSON.stringify(next));
    setFy(y);
    toast({ title: "Financial year added", description: `FY ${y}–${String(y + 1).slice(-2)} is now selected.` });
  };

  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: ss }] = await Promise.all([
        supabase.from("scheme_parties").select("*").order("name").limit(500),
        supabase.from("scheme_rules").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      setParties((ps as any) || []);
      setSavedSchemes((ss as any) || []);
    })();
  }, []);

  useEffect(() => {
    if (!vendorId) { setMonths([]); return; }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("scheme_vendor_months" as any)
        .select("*")
        .eq("party_id", vendorId)
        .eq("fy_year", fy);
      if (error) { toast({ title: "Load failed", description: error.message, variant: "destructive" }); setLoading(false); return; }
      const rows = ((data as any) || []) as VendorMonth[];
      const full: VendorMonth[] = FY_MONTHS.map((m) => {
        const existing = rows.find((r) => r.month === m);
        if (existing) {
          const invs: Invoice[] = Array.isArray((existing as any).invoices) && (existing as any).invoices.length
            ? (existing as any).invoices
            : (existing.purchase_rows && existing.purchase_rows.length
                ? [{ id: crypto.randomUUID(), label: "Invoice 1", rows: existing.purchase_rows }]
                : []);
          return { ...existing, invoices: invs };
        }
        return {
          party_id: vendorId,
          fy_year: fy,
          month: m,
          scheme_kind: "company",
          scheme_config: defaultConfig("company"),
          purchases_text: "",
          purchase_rows: [],
          invoices: [],
        };
      });
      setMonths(full);
      setLoading(false);
    })();
  }, [vendorId, fy]);

  const vendor = parties.find((p) => p.id === vendorId) || null;

  const captureCanvases = async () => {
    const node = reportRef.current;
    if (!node) throw new Error("Nothing to capture");
    const html2canvas = (await import("html2canvas-pro")).default;
    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      windowWidth: Math.max(node.scrollWidth, 1200),
    });
    return canvas;
  };

  const baseFileName = () => {
    const v = vendor ? vendor.name.replace(/[^a-z0-9]+/gi, "_") : "Vendor";
    return `Scheme_${v}_FY${fy}-${String(fy + 1).slice(-2)}`;
  };

  const exportPdf = async (share = false) => {
    if (!vendor) { toast({ title: "Pick a vendor first" }); return; }
    setExporting(true);
    try {
      const canvas = await captureCanvases();
      const { jsPDF } = await import("jspdf");
      const imgW = canvas.width;
      const imgH = canvas.height;
      const pdf = new jsPDF({ unit: "px", format: [imgW, imgH], compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgW, imgH);
      const blob = pdf.output("blob");
      const name = `${baseFileName()}.pdf`;
      if (share) {
        await shareFilesNative([blob], baseFileName(), `Scheme report — ${vendor.name}`, "pdf");
      } else {
        downloadBlob(blob, name);
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setExporting(false); }
  };

  const exportJpg = async (share = false) => {
    if (!vendor) { toast({ title: "Pick a vendor first" }); return; }
    setExporting(true);
    try {
      const canvas = await captureCanvases();
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.92)!);
      const name = `${baseFileName()}.jpg`;
      if (share) {
        await shareFilesNative([blob], baseFileName(), `Scheme report — ${vendor.name}`, "jpg");
      } else {
        downloadBlob(blob, name);
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setExporting(false); }
  };

  const exportCsv = async () => {
    if (!vendor) { toast({ title: "Pick a vendor first" }); return; }
    setExporting(true);
    try {
      const esc = (v: any) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines: string[] = [];
      lines.push(`Vendor,${esc(vendor.name)}${vendor.place ? ` — ${vendor.place}` : ""}`);
      lines.push(`FY,${fy}-${String(fy + 1).slice(-2)}`);
      lines.push(`Timeline,${mode}`);
      lines.push("");

      lines.push(["Month", "Year", "Scheme", "Total Qty", "Total Amount", "Free Units", "Achievement %"].join(","));
      let tQty = 0, tAmt = 0, tFree = 0;
      months.forEach((m) => {
        const flat = m.invoices?.length ? m.invoices.flatMap((i) => i.rows) : m.purchase_rows;
        const agg = aggregateRowsByItem(flat);
        const rep = computeFreeReport({ kind: m.scheme_kind, config: m.scheme_config }, agg) as any;
        const free = (rep.rep || []).reduce((s: number, x: any) => s + (x.free || 0), 0);
        const qty = flat.reduce((s, r) => s + (Number(r.qty) || 0), 0);
        const amt = flat.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
        const pct = computeAchievementPct({ kind: m.scheme_kind, config: m.scheme_config }, agg);
        tQty += qty; tAmt += amt; tFree += free;
        lines.push([
          MONTH_NAME[m.month],
          fyCalendarYear(fy, m.month),
          m.scheme_kind,
          qty,
          amt.toFixed(2),
          free,
          `${pct}%`,
        ].map(esc).join(","));
      });
      lines.push(["TOTAL", "", "", tQty, tAmt.toFixed(2), tFree, ""].map(esc).join(","));
      lines.push("");

      lines.push(["Month", "Invoice", "Invoice No", "Date", "Item", "Qty", "Price", "Amount (incl tax)", "MRP"].join(","));
      months.forEach((m) => {
        const mLabel = `${MONTH_NAME[m.month]} ${fyCalendarYear(fy, m.month)}`;
        const invs = m.invoices?.length ? m.invoices : (m.purchase_rows.length ? [{ id: "", label: "Invoice", rows: m.purchase_rows } as Invoice] : []);
        invs.forEach((inv) => {
          inv.rows.forEach((r) => {
            lines.push([
              mLabel, inv.label || "", inv.invoice_no || "", inv.date || "",
              r.item, r.qty, r.price, r.amountWithTax, r.mrp,
            ].map(esc).join(","));
          });
        });
      });

      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      downloadBlob(blob, `${baseFileName()}.csv`);
    } catch (e: any) {
      toast({ title: "CSV export failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setExporting(false); }
  };

  const filteredParties = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    if (!q) return parties.slice(0, 30);
    return parties.filter((p) =>
      [p.name, p.phone, p.place].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    ).slice(0, 50);
  }, [parties, vendorQuery]);

  const updateMonth = (month: number, patch: Partial<VendorMonth>) => {
    setMonths((arr) => arr.map((m) => (m.month === month ? { ...m, ...patch } : m)));
  };

  const persistMonth = async (m: VendorMonth) => {
    const flatRows: Row[] = (m.invoices && m.invoices.length)
      ? m.invoices.flatMap((inv) => inv.rows)
      : m.purchase_rows;
    const payload = {
      party_id: m.party_id,
      fy_year: m.fy_year,
      month: m.month,
      scheme_kind: m.scheme_kind,
      scheme_config: m.scheme_config,
      purchases_text: m.purchases_text,
      purchase_rows: flatRows as any,
      invoices: m.invoices as any,
    };
    const { data, error } = await supabase
      .from("scheme_vendor_months" as any)
      .upsert(payload, { onConflict: "party_id,fy_year,month" })
      .select()
      .single();
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); throw error; }
    const newId = (data as any).id;
    if (newId && newId !== m.id) updateMonth(m.month, { id: newId });
    toast({ title: `Saved ${MONTH_NAME[m.month]} ${fyCalendarYear(fy, m.month)}` });
  };

  const ytd = useMemo(() => {
    let totalAmount = 0, totalQty = 0, freeUnits = 0;
    const pcts: number[] = [];
    months.forEach((m) => {
      const flat = m.invoices && m.invoices.length ? m.invoices.flatMap((i) => i.rows) : m.purchase_rows;
      if (!flat.length) return;
      const rep = computeFreeReport(
        { kind: m.scheme_kind, config: m.scheme_config },
        aggregateRowsByItem(flat),
      );
      flat.forEach((r) => {
        totalAmount += Number(r.amountWithTax) || 0;
        totalQty += Number(r.qty) || 0;
      });
      freeUnits += rep.rep.reduce((s: number, x: any) => s + (x.free || 0), 0);
      pcts.push(computeAchievementPct(
        { kind: m.scheme_kind, config: m.scheme_config },
        aggregateRowsByItem(flat),
      ));
    });
    const completionPct = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : 0;
    return { totalAmount, totalQty, freeUnits, completionPct };
  }, [months]);

  return (
    <AdminShell>
      <div className="space-y-6 pb-28">
        <h1 className="font-display text-2xl">Vendor Scheme Dashboard</h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="calc">Vendor Dashboard</TabsTrigger>
            <TabsTrigger value="parties">Vendors ({parties.length})</TabsTrigger>
            <TabsTrigger value="schemes">Scheme Templates ({savedSchemes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="calc" className="space-y-5 pt-4">
            <div className="sticky top-0 z-20 -mx-2 rounded-2xl border bg-card/90 px-3 py-3 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendor</Label>
                  <Input
                    value={vendor ? `${vendor.name}${vendor.place ? ` — ${vendor.place}` : ""}` : vendorQuery}
                    onChange={(e) => { setVendorQuery(e.target.value); setVendorId(null); }}
                    placeholder="Search vendor by name / phone / place…"
                  />
                  {vendorQuery && !vendor && (
                    <div className="mt-1 max-h-56 overflow-auto rounded border bg-popover">
                      {filteredParties.length === 0 && <div className="p-2 text-xs text-muted-foreground">No vendors. Add one in Vendors tab.</div>}
                      {filteredParties.map((p) => (
                        <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => { setVendorId(p.id); setVendorQuery(""); }}>
                          {p.name}{p.place ? ` — ${p.place}` : ""}{p.phone ? ` · ${p.phone}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Financial Year</Label>
                  <div className="flex items-center gap-2">
                    <Select value={String(fy)} onValueChange={(v) => setFy(Number(v))}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fyOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>FY {y}–{String(y + 1).slice(-2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={addCustomFy} className="h-9 gap-1">
                      <Plus className="h-4 w-4" /> Add FY
                    </Button>
                  </div>
                </div>
                <div className="ml-auto">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Timeline</Label>
                  <div className="inline-flex rounded-full border bg-background p-1">
                    {(["monthly", "quarterly", "halfyearly", "yearly"] as TimelineMode[]).map((m) => (
                      <button key={m} onClick={() => setMode(m)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${mode === m ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                        {m === "halfyearly" ? "Half-Yearly" : m}
                      </button>
                    ))}
                  </div>
                </div>
                {vendor && (
                  <div>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">&nbsp;</Label>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={exportCsv}
                        disabled={exporting}
                        className="gap-1"
                      >
                        <FileText className="h-4 w-4" /> CSV
                      </Button>
                      <DownloadShareMenu
                        label="Share"
                        triggerSize="sm"
                        busy={exporting}
                        onPdf={() => exportPdf(false)}
                        onJpg={() => exportJpg(false)}
                        onShareLink={() => exportJpg(true)}
                        pdfTooltip="PDF — download full report"
                        jpgTooltip="JPG — download image"
                        linkTooltip="Share — open WhatsApp / share sheet with JPG"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!vendor ? (
              <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
                <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Pick a vendor above to open their full year dashboard.</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : mode === "monthly" ? (
              <div ref={reportRef} className="space-y-4 bg-background p-2">
                <div className="mb-2 flex items-baseline justify-between border-b pb-2">
                  <div className="font-display text-lg">{vendor.name}{vendor.place ? ` — ${vendor.place}` : ""}</div>
                  <div className="text-xs text-muted-foreground">FY {fy}–{String(fy + 1).slice(-2)} · Monthly</div>
                </div>
                {months.map((m) => (
                  <MonthBlock
                    key={m.month}
                    vm={m}
                    fy={fy}
                    savedSchemes={savedSchemes}
                    onChange={(patch) => updateMonth(m.month, patch)}
                    onSave={() => persistMonth(m)}
                  />
                ))}
              </div>
            ) : (
              <div ref={reportRef} className="space-y-4 bg-background p-2">
                <div className="mb-2 flex items-baseline justify-between border-b pb-2">
                  <div className="font-display text-lg">{vendor.name}{vendor.place ? ` — ${vendor.place}` : ""}</div>
                  <div className="text-xs text-muted-foreground">FY {fy}–{String(fy + 1).slice(-2)} · {mode}</div>
                </div>
                <AggregatedView
                  mode={mode}
                  fy={fy}
                  months={months}
                  savedSchemes={savedSchemes}
                  onChangeMonth={(month, patch) => updateMonth(month, patch)}
                  onSaveMonth={(m) => persistMonth(m)}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="parties" className="pt-4">
            <PartiesTab parties={parties} setParties={setParties} />
          </TabsContent>

          <TabsContent value="schemes" className="pt-4">
            <SchemesTab schemes={savedSchemes} setSchemes={setSavedSchemes} onApply={() => setTab("calc")} />
          </TabsContent>
        </Tabs>

        {vendor && (
          <div className="fixed bottom-3 left-1/2 z-30 w-[min(1200px,95vw)] -translate-x-1/2 rounded-2xl border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="font-display text-sm">FY {fy}–{String(fy + 1).slice(-2)} · {vendor.name}</div>
              <div className="ml-auto flex flex-wrap items-center gap-5">
                <Stat label="YTD Purchases" value={`₹${fmt(ytd.totalAmount)}`} />
                <Stat label="Total Qty" value={fmt(ytd.totalQty)} />
                <Stat label="Free Units Earned" value={fmt(ytd.freeUnits)} tone="success" />
                <div className="flex items-center gap-2">
                  <ProgressRing pct={ytd.completionPct} size={42} stroke={5} />
                  <div className="leading-tight">
                    <div className="text-[10px] uppercase text-muted-foreground">Completion</div>
                    <div className="text-sm font-semibold">{ytd.completionPct}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
};

export default AdminSchemeCalculator;
