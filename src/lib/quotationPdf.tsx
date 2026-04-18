import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer";
import logo from "@/assets/hitech-logo.jpeg";
import { BANK_DETAILS, COMPANY } from "./companyInfo";

// PDF-safe INR formatter: Helvetica doesn't include the ₹ glyph, which can
// render amounts as a tiny/blank box. Use "Rs." prefix + Indian digit grouping.
const formatINR = (n: number | null | undefined) => {
  if (n == null) return "-";
  const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
  return `Rs. ${num}`;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", color: "#0F2A2E", backgroundColor: "#FFFFFF", fontSize: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottom: "1.5pt solid #0E5C66", paddingBottom: 10, marginBottom: 14 },
  logo: { width: 100, height: 44, objectFit: "contain" },
  brandRight: { textAlign: "right" },
  brandName: { fontSize: 13, fontWeight: 700, color: "#0E5C66" },
  brandLine: { fontSize: 8, color: "#6E7F82", marginTop: 2 },
  hTitle: { fontSize: 18, fontWeight: 700, color: "#0E5C66", marginBottom: 8, textAlign: "center" },
  partyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, gap: 12 },
  partyBox: { flex: 1, padding: 8, backgroundColor: "#F4F7F7", borderRadius: 4 },
  partyLabel: { fontSize: 7, color: "#6E7F82", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  partyValue: { fontSize: 10, fontWeight: 600, color: "#0F2A2E" },
  table: { borderWidth: 0.75, borderColor: "#0E5C66", marginBottom: 10 },
  tHead: { flexDirection: "row", backgroundColor: "#0E5C66" },
  th: { color: "#FFFFFF", fontSize: 8.5, fontWeight: 700, padding: 5, borderRightWidth: 0.5, borderRightColor: "#FFFFFF" },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#D8DEDF", minHeight: 32 },
  td: { fontSize: 9, padding: 5, borderRightWidth: 0.5, borderRightColor: "#D8DEDF" },
  tdImg: { width: 50, height: 50, objectFit: "contain" },
  totalsBox: { marginLeft: "auto", width: 230, borderWidth: 0.75, borderColor: "#0E5C66", borderRadius: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: 6, borderBottomWidth: 0.5, borderBottomColor: "#D8DEDF" },
  totalLabel: { fontSize: 9, color: "#1F3F44" },
  totalValue: { fontSize: 10, fontWeight: 600, color: "#0F2A2E" },
  grandRow: { flexDirection: "row", justifyContent: "space-between", padding: 8, backgroundColor: "#0E5C66" },
  grandLabel: { color: "#FFFFFF", fontSize: 11, fontWeight: 700 },
  grandValue: { color: "#FFFFFF", fontSize: 13, fontWeight: 700 },
  bankBox: { marginTop: 14, padding: 10, borderWidth: 0.75, borderColor: "#0E5C66", borderRadius: 4 },
  bankTitle: { fontSize: 10, fontWeight: 700, color: "#0E5C66", marginBottom: 4 },
  bankLine: { fontSize: 9, color: "#1F3F44", marginBottom: 1 },
  termsBox: { marginTop: 10, padding: 10, borderWidth: 0.75, borderColor: "#0E5C66", borderRadius: 4, backgroundColor: "#FAFCFC" },
  termsTitle: { fontSize: 10, fontWeight: 700, color: "#0E5C66", marginBottom: 4 },
  termsLine: { fontSize: 8.5, color: "#1F3F44", marginBottom: 2, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, textAlign: "center", fontSize: 7.5, color: "#6E7F82", borderTopWidth: 0.5, borderTopColor: "#D8DEDF", paddingTop: 5 },
});

const cols = { sl: 22, desc: 150, img: 60, meas: 90, qty: 30, price: 60, amt: 70 };

export type QuotationItemPdf = {
  description: string;
  item_image_url: string | null;
  measurement: string | null;
  measurement_image_url: string | null;
  /** Set internally during PDF generation: list of data-URI images to render. */
  measurement_images?: string[];
  quantity: number;
  unit_price: number;
  amount: number;
};

export type QuotationPdfData = {
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  party_address: string | null;
  quotation_date: string;
  expected_delivery_date: string | null;
  gst_percent: number;
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
  terms?: string | null;
  items: QuotationItemPdf[];
};

const QuotationDoc = ({ q }: { q: QuotationPdfData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Image src={logo} style={styles.logo} />
        <View style={styles.brandRight}>
          <Text style={styles.brandName}>{COMPANY.name}</Text>
          <Text style={styles.brandLine}>{COMPANY.address}</Text>
          <Text style={styles.brandLine}>Phone: {COMPANY.phone}</Text>
        </View>
      </View>

      <Text style={styles.hTitle}>QUOTATION</Text>

      <View style={styles.partyRow}>
        <View style={styles.partyBox}>
          <Text style={styles.partyLabel}>Quotation No.</Text>
          <Text style={styles.partyValue}>{q.quotation_id}</Text>
          <Text style={[styles.partyLabel, { marginTop: 6 }]}>Date</Text>
          <Text style={styles.partyValue}>{q.quotation_date}</Text>
          {q.expected_delivery_date && (
            <>
              <Text style={[styles.partyLabel, { marginTop: 6 }]}>Expected Delivery</Text>
              <Text style={styles.partyValue}>{q.expected_delivery_date}</Text>
            </>
          )}
        </View>
        <View style={styles.partyBox}>
          <Text style={styles.partyLabel}>Party Name</Text>
          <Text style={styles.partyValue}>{q.party_name}</Text>
          <Text style={[styles.partyLabel, { marginTop: 6 }]}>Place</Text>
          <Text style={styles.partyValue}>{q.party_place}</Text>
          {q.party_phone && (
            <>
              <Text style={[styles.partyLabel, { marginTop: 6 }]}>Phone</Text>
              <Text style={styles.partyValue}>{q.party_phone}</Text>
            </>
          )}
          {q.party_address && (
            <>
              <Text style={[styles.partyLabel, { marginTop: 6 }]}>Address</Text>
              <Text style={styles.partyValue}>{q.party_address}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tHead}>
          <Text style={[styles.th, { width: cols.sl }]}>SL</Text>
          <Text style={[styles.th, { width: cols.desc }]}>Description of Goods</Text>
          <Text style={[styles.th, { width: cols.img }]}>Image</Text>
          <Text style={[styles.th, { width: cols.meas }]}>Measurement</Text>
          <Text style={[styles.th, { width: cols.qty, textAlign: "right" }]}>Qty</Text>
          <Text style={[styles.th, { width: cols.price, textAlign: "right" }]}>Price</Text>
          <Text style={[styles.th, { width: cols.amt, textAlign: "right" }]}>Amount</Text>
        </View>
        {q.items.map((it, i) => (
          <View key={i} style={styles.tRow} wrap={false}>
            <Text style={[styles.td, { width: cols.sl }]}>{i + 1}</Text>
            <Text style={[styles.td, { width: cols.desc }]}>{it.description}</Text>
            <View style={[styles.td, { width: cols.img, alignItems: "center", justifyContent: "center" }]}>
              {it.item_image_url && it.item_image_url.startsWith("data:") ? <Image src={it.item_image_url} style={styles.tdImg} /> : <Text style={{ fontSize: 8, color: "#9AA8AA" }}>-</Text>}
            </View>
            <View style={[styles.td, { width: cols.meas }]}>
              {it.measurement && <Text style={{ fontSize: 9 }}>{it.measurement}</Text>}
              {(it.measurement_images ?? []).filter((s) => s && s.startsWith("data:")).length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 2, gap: 2 }}>
                  {(it.measurement_images ?? []).filter((s) => s && s.startsWith("data:")).map((src, k) => (
                    <Image key={k} src={src} style={{ width: 42, height: 42, objectFit: "contain" }} />
                  ))}
                </View>
              )}
            </View>
            <Text style={[styles.td, { width: cols.qty, textAlign: "right" }]}>{it.quantity}</Text>
            <Text style={[styles.td, { width: cols.price, textAlign: "right" }]}>{formatINR(it.unit_price)}</Text>
            <Text style={[styles.td, { width: cols.amt, textAlign: "right" }]}>{formatINR(it.amount)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totalsBox}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatINR(q.subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>GST ({q.gst_percent}%)</Text>
          <Text style={styles.totalValue}>{formatINR(q.gst_amount)}</Text>
        </View>
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>GRAND TOTAL</Text>
          <Text style={styles.grandValue}>{formatINR(q.total)}</Text>
        </View>
      </View>

      <View style={styles.bankBox} wrap={false}>
        <Text style={styles.bankTitle}>Bank Details</Text>
        <Text style={styles.bankLine}>Bank: {BANK_DETAILS.bankName}</Text>
        <Text style={styles.bankLine}>A/c Name: {BANK_DETAILS.accountName}</Text>
        <Text style={styles.bankLine}>A/c Number: {BANK_DETAILS.accountNumber}</Text>
        <Text style={styles.bankLine}>IFSC: {BANK_DETAILS.ifsc}</Text>
        <Text style={styles.bankLine}>Branch: {BANK_DETAILS.branch}</Text>
      </View>

      {q.terms && q.terms.trim() !== "" && (
        <View style={styles.termsBox} wrap={false}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          {q.terms.split(/\r?\n/).filter((l) => l.trim() !== "").map((line, idx) => (
            <Text key={idx} style={styles.termsLine}>{line}</Text>
          ))}
        </View>
      )}

      {q.notes && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 9, color: "#6E7F82" }}>Notes: {q.notes}</Text>
        </View>
      )}

      <Text style={styles.footer}>{COMPANY.name} · {COMPANY.address} · {COMPANY.phone}</Text>
    </Page>
  </Document>
);

// Pre-fetch a remote image and convert to data URI so @react-pdf/renderer
// never fails on CORS / 404 / slow networks. Returns null on failure.
async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  // Already a data URI - use as-is
  if (url.startsWith("data:")) return url;
  try {
    // credentials: 'omit' avoids sending stale cookies that some CDNs reject
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-cache" });
    if (!res.ok) {
      console.warn(`[PDF] image fetch ${res.status} for ${url}`);
      return null;
    }
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) {
      console.warn(`[PDF] non-image blob (${blob.type}) for ${url}`);
      return null;
    }
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn(`[PDF] image fetch threw for ${url}:`, e);
    return null;
  }
}

export async function generateQuotationPdf(q: QuotationPdfData): Promise<Blob> {
  const items = await Promise.all(
    q.items.map(async (it) => {
      const measUrls = (it.measurement_image_url ?? "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const measDataUris = (await Promise.all(measUrls.map((u) => toDataUri(u)))).filter(
        (u): u is string => !!u
      );
      return {
        ...it,
        item_image_url: await toDataUri(it.item_image_url),
        measurement_image_url: measDataUris[0] ?? null,
        measurement_images: measDataUris,
      };
    })
  );
  const safe = { ...q, items };
  return await pdf(<QuotationDoc q={safe} />).toBlob();
}

// ===== Job Work PDF (worker-safe: NO prices, NO bank, NO customer phone) =====

// A4 usable width with 28pt page padding = 595 - 56 = 539pt
// Column widths sum to 539: SL(26) + Item(150) + Photo(110) + Measurement(195) + Qty(58)
const JW_COLS = { sl: 26, item: 150, photo: 110, meas: 195, qty: 58 };

const jwStyles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 28, fontFamily: "Helvetica", color: "#0F2A2E", fontSize: 10, backgroundColor: "#FFFFFF" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1.5, borderBottomColor: "#0E5C66", paddingBottom: 10, marginBottom: 12 },
  logo: { width: 100, height: 44, objectFit: "contain" },
  brandRight: { textAlign: "right" },
  brandName: { fontSize: 13, fontWeight: 700, color: "#0E5C66" },
  brandLine: { fontSize: 8, color: "#6E7F82", marginTop: 2 },

  hTitle: { fontSize: 17, fontWeight: 700, color: "#0E5C66", marginBottom: 10, textAlign: "center", letterSpacing: 1 },

  metaStrip: { flexDirection: "row", borderWidth: 0.75, borderColor: "#0E5C66", borderRadius: 4, marginBottom: 12 },
  metaCell: { flex: 1, padding: 8, borderRightWidth: 0.5, borderRightColor: "#0E5C66" },
  metaCellLast: { flex: 1, padding: 8 },
  metaLabel: { fontSize: 7.5, color: "#6E7F82", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  metaValue: { fontSize: 11, fontWeight: 700, color: "#0F2A2E" },

  table: { borderWidth: 0.75, borderColor: "#0E5C66", borderRadius: 2, marginBottom: 10 },
  tHead: { flexDirection: "row", backgroundColor: "#0E5C66" },
  th: { color: "#FFFFFF", fontSize: 9, fontWeight: 700, padding: 6, borderRightWidth: 0.5, borderRightColor: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.4 },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#0E5C66", alignItems: "stretch" },
  tRowAlt: { backgroundColor: "#FAFCFC" },
  td: { padding: 6, borderRightWidth: 0.5, borderRightColor: "#D8DEDF", justifyContent: "flex-start" },

  cellSl: { fontSize: 11, fontWeight: 700, color: "#0E5C66", textAlign: "center" },
  cellItem: { fontSize: 10, color: "#0F2A2E", lineHeight: 1.35 },
  cellQty: { fontSize: 14, fontWeight: 700, color: "#0E5C66", textAlign: "center" },

  photoBox: { width: 96, height: 96, alignSelf: "center", borderWidth: 0.5, borderColor: "#D8DEDF", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC" },
  photoImg: { width: 92, height: 92, objectFit: "contain" },
  photoEmpty: { fontSize: 7.5, color: "#9AA8AA" },

  measText: { fontSize: 10, color: "#0F2A2E", marginBottom: 4 },
  sketchLabel: { fontSize: 7, color: "#6E7F82", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2, marginBottom: 2 },
  sketchBox: { width: "100%", height: 80, borderWidth: 0.5, borderColor: "#D8DEDF", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC" },
  sketchImg: { width: 178, height: 76, objectFit: "contain" },

  notesBox: { marginTop: 8, padding: 8, borderWidth: 0.5, borderColor: "#D8DEDF", borderRadius: 4, backgroundColor: "#FAFCFC" },
  notesTitle: { fontSize: 9, fontWeight: 700, color: "#0E5C66", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  notesText: { fontSize: 9.5, color: "#0F2A2E", lineHeight: 1.4 },

  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  signCol: { width: 180, alignItems: "center" },
  signLine: { borderTopWidth: 0.75, borderTopColor: "#0F2A2E", width: "100%", marginBottom: 4 },
  signLabel: { fontSize: 8.5, color: "#6E7F82", textTransform: "uppercase", letterSpacing: 0.6 },

  footer: { position: "absolute", bottom: 18, left: 28, right: 28, textAlign: "center", fontSize: 7.5, color: "#6E7F82", borderTopWidth: 0.5, borderTopColor: "#D8DEDF", paddingTop: 5 },
  pageNo: { position: "absolute", bottom: 6, right: 28, fontSize: 7.5, color: "#9AA8AA" },
});

export type JobWorkPdfData = {
  quotation_id: string;
  worker_name: string;
  date: string;
  notes: string | null;
  items: {
    description: string;
    item_image_url: string | null;
    measurement: string | null;
    measurement_image_url: string | null;
    /** Set internally during PDF generation: list of data-URI sketches/cloth refs. */
    measurement_images?: string[];
    quantity: number;
  }[];
};

const JobWorkDoc = ({ d }: { d: JobWorkPdfData }) => (
  <Document>
    <Page size="A4" style={jwStyles.page}>
      <View style={jwStyles.header} fixed>
        <Image src={logo} style={jwStyles.logo} />
        <View style={jwStyles.brandRight}>
          <Text style={jwStyles.brandName}>{COMPANY.name}</Text>
          <Text style={jwStyles.brandLine}>{COMPANY.address}</Text>
          <Text style={jwStyles.brandLine}>Phone: {COMPANY.phone}</Text>
        </View>
      </View>

      <Text style={jwStyles.hTitle}>JOB WORK ORDER</Text>

      <View style={jwStyles.metaStrip}>
        <View style={jwStyles.metaCell}>
          <Text style={jwStyles.metaLabel}>Reference</Text>
          <Text style={jwStyles.metaValue}>{d.quotation_id}</Text>
        </View>
        <View style={jwStyles.metaCell}>
          <Text style={jwStyles.metaLabel}>Worker</Text>
          <Text style={jwStyles.metaValue}>{d.worker_name}</Text>
        </View>
        <View style={jwStyles.metaCellLast}>
          <Text style={jwStyles.metaLabel}>Date</Text>
          <Text style={jwStyles.metaValue}>{d.date}</Text>
        </View>
      </View>

      <View style={jwStyles.table}>
        <View style={jwStyles.tHead} fixed>
          <Text style={[jwStyles.th, { width: JW_COLS.sl, textAlign: "center" }]}>SL</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.item }]}>Item Description</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.photo, textAlign: "center" }]}>Photo</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.meas }]}>Measurement</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.qty, textAlign: "center", borderRightWidth: 0 }]}>Qty</Text>
        </View>

        {d.items.map((it, i) => (
          <View key={i} style={[jwStyles.tRow, i % 2 === 1 ? jwStyles.tRowAlt : {}]} wrap={false}>
            <View style={[jwStyles.td, { width: JW_COLS.sl, justifyContent: "center" }]}>
              <Text style={jwStyles.cellSl}>{i + 1}</Text>
            </View>
            <View style={[jwStyles.td, { width: JW_COLS.item }]}>
              <Text style={jwStyles.cellItem}>{it.description || "-"}</Text>
            </View>
            <View style={[jwStyles.td, { width: JW_COLS.photo, justifyContent: "center" }]}>
              <View style={jwStyles.photoBox}>
                {it.item_image_url ? (
                  <Image src={it.item_image_url} style={jwStyles.photoImg} />
                ) : (
                  <Text style={jwStyles.photoEmpty}>No photo</Text>
                )}
              </View>
            </View>
            <View style={[jwStyles.td, { width: JW_COLS.meas }]}>
              {it.measurement ? (
                <Text style={jwStyles.measText}>{it.measurement}</Text>
              ) : (
                (it.measurement_images ?? []).length === 0 && <Text style={[jwStyles.measText, { color: "#9AA8AA" }]}>-</Text>
              )}
              {(it.measurement_images ?? []).length > 0 && (
                <>
                  <Text style={jwStyles.sketchLabel}>Sketch / Cloth</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
                    {(it.measurement_images ?? []).map((src, k) => (
                      <View key={k} style={{ width: 86, height: 80, borderWidth: 0.5, borderColor: "#D8DEDF", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC" }}>
                        <Image src={src} style={{ width: 82, height: 76, objectFit: "contain" }} />
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
            <View style={[jwStyles.td, { width: JW_COLS.qty, justifyContent: "center", borderRightWidth: 0 }]}>
              <Text style={jwStyles.cellQty}>{it.quantity}</Text>
            </View>
          </View>
        ))}
      </View>

      {d.notes && d.notes.trim() !== "" && (
        <View style={jwStyles.notesBox} wrap={false}>
          <Text style={jwStyles.notesTitle}>Instructions / Notes</Text>
          <Text style={jwStyles.notesText}>{d.notes}</Text>
        </View>
      )}

      <View style={jwStyles.signRow} wrap={false}>
        <View style={jwStyles.signCol}>
          <View style={jwStyles.signLine} />
          <Text style={jwStyles.signLabel}>Worker Signature</Text>
        </View>
        <View style={jwStyles.signCol}>
          <View style={jwStyles.signLine} />
          <Text style={jwStyles.signLabel}>Authorised Signatory</Text>
        </View>
      </View>

      <Text style={jwStyles.footer} fixed>{COMPANY.name} · {COMPANY.address} · {COMPANY.phone}</Text>
      <Text style={jwStyles.pageNo} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </Page>
  </Document>
);

export async function generateJobWorkPdf(d: JobWorkPdfData): Promise<Blob> {
  const items = await Promise.all(
    d.items.map(async (it) => {
      const measUrls = (it.measurement_image_url ?? "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const measDataUris = (await Promise.all(measUrls.map((u) => toDataUri(u)))).filter(
        (u): u is string => !!u
      );
      return {
        ...it,
        item_image_url: await toDataUri(it.item_image_url),
        measurement_image_url: measDataUris[0] ?? null,
        measurement_images: measDataUris,
      };
    })
  );
  const safe = { ...d, items };
  return await pdf(<JobWorkDoc d={safe} />).toBlob();
}
