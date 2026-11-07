import { Document, Page, Text, View, StyleSheet, Image, Svg, Path, Circle, Rect, pdf } from "@react-pdf/renderer";
import logo from "@/assets/hitech-logo-wide.jpg";
import sealSign from "@/assets/hitech-seal-signed.png";
import headerArt from "@/assets/quote-header-art.jpg";
import footerWave from "@/assets/quote-footer-wave.png";
import { BANK_DETAILS, COMPANY } from "./companyInfo";
import { firstUrl } from "./firstUrl";

// PDF-safe INR formatters.
// Helvetica doesn't include the ₹ glyph (renders as a blank box), so we use
// the "Rs " prefix when we need a currency marker, but plain digits inside
// the line-item table — the column header now reads "Price (INR)" / "Amount (INR)".
const fmtNum = (n: number | null | undefined) => {
  if (n == null) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
};
const formatINR = (n: number | null | undefined) => {
  if (n == null) return "-";
  return `Rs ${fmtNum(n)}`;
};

// A4 = 595 x 842 pt. Side padding 28pt → usable width = 539pt
const BROWN = "#5E2D05";
const BROWN_MID = "#8A4B1F";
const CREAM = "#FBEFE4";
const CREAM_SOFT = "#FDF6EE";
const LINE = "#E6CDB5";
const styles = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 76, paddingHorizontal: 28, fontFamily: "Helvetica", color: "#292522", backgroundColor: "#FFFFFF", fontSize: 12 },
  heroArt: { position: "absolute", top: 0, right: 0, width: 330, height: 180 },
  wave: { position: "absolute", bottom: 0, left: 0, width: 595, height: 70 },
  headerBlock: { height: 138 },
  logo: { width: 176, height: 73 },
  addrLine: { fontSize: 9.5, color: "#3B2A1C", marginTop: 2.5, fontWeight: 600 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 10 },
  titleBand: { width: 260, height: 38, justifyContent: "center" },
  titleText: { position: "absolute", left: 18, top: 8, fontSize: 20, fontWeight: 700, color: "#FFFFFF", letterSpacing: 6 },
  metaBox: { flexDirection: "row", alignItems: "center", backgroundColor: CREAM, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { fontSize: 8, color: "#3B2A1C" },
  metaValue: { fontSize: 12, fontWeight: 700, color: "#1F140B" },
  metaDivider: { width: 0.75, height: 24, backgroundColor: "#9C7B5E" },
  partyWrap: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingBottom: 9, marginBottom: 10, borderBottomWidth: 0.75, borderBottomColor: "#D9B99B" },
  partyLabel: { fontSize: 9, color: "#3B2A1C", marginBottom: 2 },
  partyName: { fontSize: 15, fontWeight: 700, color: "#1F140B" },
  partyLine: { fontSize: 10.5, color: "#3B2A1C", marginTop: 1.5 },
  table: { borderWidth: 0.75, borderColor: LINE, borderRadius: 6, marginBottom: 10 },
  tHead: { flexDirection: "row", backgroundColor: BROWN, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  th: { color: "#FFFFFF", fontSize: 10, fontWeight: 700, padding: 6, borderRightWidth: 0.5, borderRightColor: BROWN_MID },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: LINE, minHeight: 44 },
  tRowAlt: { backgroundColor: CREAM_SOFT },
  td: { fontSize: 11, padding: 6, borderRightWidth: 0.5, borderRightColor: LINE },
  tdImg: { width: 60, height: 60, objectFit: "contain" },
  lowerRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  totalsBox: { width: 235, borderWidth: 0.75, borderColor: LINE, borderRadius: 6, backgroundColor: CREAM_SOFT },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: 7, borderBottomWidth: 0.5, borderBottomColor: LINE },
  totalLabel: { fontSize: 10.5, color: "#3B2A1C" },
  totalValue: { fontSize: 11.5, fontWeight: 600, color: "#292522" },
  grandRow: { flexDirection: "row", alignItems: "stretch", backgroundColor: CREAM, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  grandLabel: { flex: 1, color: BROWN, fontSize: 11, fontWeight: 700, padding: 9 },
  grandValueBox: { backgroundColor: BROWN, paddingHorizontal: 12, justifyContent: "center", borderBottomRightRadius: 5 },
  grandValue: { color: "#FFFFFF", fontSize: 14, fontWeight: 700 },
  bankBox: { flex: 1, padding: 10, borderRadius: 6, backgroundColor: CREAM },
  bankTitle: { fontSize: 11, fontWeight: 700, color: BROWN, marginBottom: 4 },
  bankLine: { fontSize: 9.5, color: "#3B2A1C", marginBottom: 1.5 },
  termsBox: { marginTop: 10, borderRadius: 6, backgroundColor: CREAM },
  termsHead: { paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: LINE },
  termsTitle: { fontSize: 11, fontWeight: 700, color: BROWN },
  termsBody: { paddingVertical: 5, paddingHorizontal: 10 },
  termsRow: { flexDirection: "row", marginBottom: 2 },
  termsNum: { width: 14, fontSize: 8.8, color: BROWN, fontWeight: 700 },
  termsLine: { flex: 1, fontSize: 8.8, color: "#3B2A1C", lineHeight: 1.4 },
  thanks: { alignItems: "flex-end", marginTop: 8 },
  thanksScript: { fontFamily: "Times-Italic", fontSize: 24, color: BROWN },
  thanksUnder: { width: 120, height: 2, backgroundColor: "#F2A12B", marginTop: 1 },
  thanksSub: { fontSize: 7.5, letterSpacing: 2.2, color: "#1F140B", fontWeight: 700, marginTop: 4 },
  contHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottomWidth: 0.75, borderBottomColor: "#D9B99B" },
});

// Sum = 549 (usable 551pt minus table borderWidth 0.75 × 2 sides = 1.5pt → floor to 549).
// desc trimmed 120→118 to absorb the 2pt; all other cols unchanged.
const cols = { sl: 24, desc: 112, img: 66, meas: 90, cat: 94, qty: 28, price: 60, amt: 63 };

export type QuotationItemPdf = {
  description: string;
  item_notes?: string | null;
  item_image_url: string | null;
  measurement: string | null;
  measurement_image_url: string | null;
  catalog_text: string | null;
  catalog_image_url: string | null;
  sketch_url?: string | null;
  site_photos?: string | null;
  /** Set internally during PDF generation: list of data-URI images to render. */
  measurement_images?: string[];
  catalog_images?: string[];
  sketch_data_uri?: string | null;
  site_photos_data?: string[];
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
  discount_amount?: number;
  gst_amount: number;
  total: number;
  advance_amount?: number;
  balance_due?: number;
  notes: string | null;
  terms?: string | null;
  /** Prints company seal + signature under the terms (admin opt-in). */
  show_seal_sign?: boolean;
  items: QuotationItemPdf[];
  /** When true, renders as PURCHASE ORDER: no prices, no totals, no bank, no terms. */
  is_po?: boolean;
};

type PdfImageOptions = {
  maxSide?: number;
  jpegQuality?: number;
};

type PdfRenderOptions = {
  image?: PdfImageOptions;
};

const DocIcon = () => (
  <Svg width={20} height={22} viewBox="0 0 20 22">
    <Path d="M4 1.5 H12.5 L17 6 V19.5 H4 Z" stroke={BROWN} strokeWidth={1.4} fill="none" />
    <Path d="M7 10 H14 M7 13 H14 M7 16 H12" stroke={BROWN} strokeWidth={1.2} />
  </Svg>
);
const CalIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 22 22">
    <Rect x={2.5} y={4} width={17} height={15} rx={2} stroke={BROWN} strokeWidth={1.4} fill="none" />
    <Path d="M2.5 9 H19.5 M7 1.8 V5.5 M15 1.8 V5.5" stroke={BROWN} strokeWidth={1.4} />
    <Path d="M6.5 12.5 H9 M10.5 12.5 H13 M6.5 15.5 H9" stroke={BROWN} strokeWidth={1.2} />
  </Svg>
);
const PersonIcon = () => (
  <Svg width={26} height={28} viewBox="0 0 26 28">
    <Circle cx={13} cy={8} r={5.5} stroke={BROWN} strokeWidth={1.6} fill="none" />
    <Path d="M3 26 C3 18.5 8 15.5 13 15.5 C18 15.5 23 18.5 23 26 Z" stroke={BROWN} strokeWidth={1.6} fill="none" />
  </Svg>
);

const shortDocNo = (id: string) => id.split(" / ")[0];

export const QuotationDoc = ({ q }: { q: QuotationPdfData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Fixed footer wave on every page */}
      <Image src={footerWave} style={styles.wave} fixed />

      {/* Compact header on pages 2+ */}
      <View
        fixed
        render={({ pageNumber }) =>
          pageNumber > 1 ? (
            <View style={styles.contHeader}>
              <Image src={logo} style={{ width: 84, height: 35 }} />
              <Text style={{ fontSize: 10, color: BROWN, fontWeight: 700 }}>
                {q.is_po ? "PURCHASE ORDER" : "QUOTATION"} · {shortDocNo(q.quotation_id)}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Page-1 hero header */}
      <Image src={headerArt} style={styles.heroArt} />
      <View style={styles.headerBlock}>
        <Image src={logo} style={styles.logo} />
        <Text style={[styles.addrLine, { marginTop: 8 }]}>Edapetty Shopping Centre,</Text>
        <Text style={styles.addrLine}>Edapetty, Kalpetta, Wayanad - 673122</Text>
        <Text style={styles.addrLine}>Ph: {COMPANY.phone}</Text>
      </View>

      {/* Title band + number/date */}
      <View style={styles.titleRow}>
        <View style={styles.titleBand}>
          <Svg width={260} height={38} viewBox="0 0 260 38" style={{ position: "absolute", top: 0, left: 0 }}>
            <Path d="M0 0 H252 Q262 0 255 8 L238 30 Q233 38 222 38 H0 Z" fill={BROWN} />
          </Svg>
          <Text style={styles.titleText}>{q.is_po ? "PURCHASE ORDER" : "QUOTATION"}</Text>
        </View>
        <View>
          <View style={styles.metaBox}>
            <View style={styles.metaItem}>
              <DocIcon />
              <View>
                <Text style={styles.metaLabel}>{q.is_po ? "PO No." : "Quotation No."}</Text>
                <Text style={styles.metaValue}>{shortDocNo(q.quotation_id)}</Text>
              </View>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <CalIcon />
              <View>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>{q.quotation_date}</Text>
              </View>
            </View>
          </View>
          {q.expected_delivery_date && (
            <Text style={{ fontSize: 9, color: "#3B2A1C", textAlign: "right", marginTop: 3 }}>
              Delivery Date: <Text style={{ fontWeight: 700 }}>{q.expected_delivery_date}</Text>
            </Text>
          )}
        </View>
      </View>

      {/* Party */}
      <View style={styles.partyWrap}>
        <PersonIcon />
        <View style={{ flex: 1 }}>
          <Text style={styles.partyLabel}>{q.is_po ? "Worker / Supplier" : "Quotation For"}</Text>
          <Text style={styles.partyName}>{q.party_name}</Text>
          <Text style={styles.partyLine}>{q.party_place}</Text>
          {q.party_address ? <Text style={styles.partyLine}>{q.party_address}</Text> : null}
          {q.party_phone ? <Text style={styles.partyLine}>Phone: {q.party_phone}</Text> : null}
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tHead} fixed>
          <Text style={[styles.th, { width: cols.sl }]}>Sl</Text>
          <Text style={[styles.th, { width: cols.desc }]}>Description</Text>
          <Text style={[styles.th, { width: cols.img }]}>Image</Text>
          <Text style={[styles.th, { width: cols.meas }]}>Measurement</Text>
          <Text style={[styles.th, { width: cols.cat }]}>Catalog</Text>
          <Text style={[styles.th, { width: cols.qty, textAlign: "right" }]}>Qty</Text>
          {!q.is_po && (
            <>
              <Text style={[styles.th, { width: cols.price, textAlign: "right" }]}>Price (INR)</Text>
              <Text style={[styles.th, { width: cols.amt, textAlign: "right" }]}>Amount (INR)</Text>
            </>
          )}
        </View>
        {q.items.map((it, i) => (
          <View key={i} style={[styles.tRow, i % 2 === 1 ? styles.tRowAlt : null]} wrap={false}>
            <Text style={[styles.td, { width: cols.sl }]}>{i + 1}</Text>
            <View style={[styles.td, { width: cols.desc }]}>
              <Text style={{ fontWeight: 700 }}>{it.description}</Text>
              {it.item_notes?.trim() ? (
                <Text style={{ marginTop: 3, fontSize: 9.5, color: "#6B5848", lineHeight: 1.35 }}>
                  {it.item_notes}
                </Text>
              ) : null}
            </View>
            <View style={[styles.td, { width: cols.img, alignItems: "center", justifyContent: "center" }]}>
              {it.item_image_url && it.item_image_url.startsWith("data:") ? <Image src={it.item_image_url} style={styles.tdImg} /> : <Text style={{ fontSize: 10, color: "#B8A594" }}>-</Text>}
            </View>
            <View style={[styles.td, { width: cols.meas }]}>
              {it.measurement ? <Text style={{ fontSize: 11 }}>{it.measurement}</Text> : <Text style={{ fontSize: 10, color: "#B8A594" }}>-</Text>}
              {(it.measurement_images ?? []).filter((s) => s && s.startsWith("data:")).length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3, gap: 3 }}>
                  {(it.measurement_images ?? []).filter((s) => s && s.startsWith("data:")).map((src, k) => (
                    <Image key={k} src={src} style={{ width: 42, height: 42, objectFit: "contain" }} />
                  ))}
                </View>
              )}
              {it.sketch_data_uri && (
                <View style={{ marginTop: 3 }}>
                  <Image src={it.sketch_data_uri} style={{ width: cols.meas - 12, height: 60, objectFit: "contain", borderWidth: 0.5, borderColor: LINE }} />
                </View>
              )}
              {(it.site_photos_data ?? []).length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3, gap: 3 }}>
                  {(it.site_photos_data ?? []).map((src, k) => (
                    <Image key={`s-${k}`} src={src} style={{ width: 42, height: 42, objectFit: "contain" }} />
                  ))}
                </View>
              )}
            </View>
            <View style={[styles.td, { width: cols.cat }]}>
              {it.catalog_text ? <Text style={{ fontSize: 11 }}>{it.catalog_text}</Text> : null}
              {(it.catalog_images ?? []).filter((s) => s && s.startsWith("data:")).length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3, gap: 3 }}>
                  {(it.catalog_images ?? []).filter((s) => s && s.startsWith("data:")).map((src, k) => (
                    <Image key={k} src={src} style={{ width: 42, height: 42, objectFit: "contain" }} />
                  ))}
                </View>
              )}
            </View>
            <Text style={[styles.td, { width: cols.qty, textAlign: "right" }]}>{it.quantity}</Text>
            {!q.is_po && (
              <>
                <Text style={[styles.td, { width: cols.price, textAlign: "right" }]}>{fmtNum(it.unit_price)}</Text>
                <Text style={[styles.td, { width: cols.amt, textAlign: "right" }]}>{fmtNum(it.amount)}</Text>
              </>
            )}
          </View>
        ))}
      </View>

      {!q.is_po && (
        <View style={styles.lowerRow} wrap={false}>
          <View style={styles.bankBox}>
            <Text style={styles.bankTitle}>Bank Details</Text>
            <Text style={styles.bankLine}>Bank: {BANK_DETAILS.bankName}</Text>
            <Text style={styles.bankLine}>A/c Name: {BANK_DETAILS.accountName}</Text>
            <Text style={styles.bankLine}>A/c Number: {BANK_DETAILS.accountNumber}</Text>
            <Text style={styles.bankLine}>IFSC: {BANK_DETAILS.ifsc}</Text>
            <Text style={styles.bankLine}>Branch: {BANK_DETAILS.branch}</Text>
          </View>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal (INR)</Text>
              <Text style={styles.totalValue}>{fmtNum(q.subtotal)}</Text>
            </View>
            {(q.discount_amount ?? 0) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount (INR)</Text>
                <Text style={styles.totalValue}>- {fmtNum(q.discount_amount)}</Text>
              </View>
            )}
            {(q.gst_percent ?? 0) > 0 && (q.gst_amount ?? 0) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>GST {q.gst_percent}% (INR)</Text>
                <Text style={styles.totalValue}>{fmtNum(q.gst_amount)}</Text>
              </View>
            )}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Total Amount (INR)</Text>
              <View style={styles.grandValueBox}>
                <Text style={styles.grandValue}>{formatINR(q.total)}</Text>
              </View>
            </View>
            {(q.advance_amount ?? 0) > 0 && (
              <>
                <View style={[styles.totalRow, { borderTopWidth: 0.5, borderTopColor: LINE }]}>
                  <Text style={styles.totalLabel}>Less: Advance Received (INR)</Text>
                  <Text style={styles.totalValue}>- {fmtNum(q.advance_amount)}</Text>
                </View>
                <View style={[styles.grandRow, { backgroundColor: BROWN_MID }]}>
                  <Text style={[styles.grandLabel, { color: "#FFFFFF" }]}>BALANCE DUE</Text>
                  <View style={[styles.grandValueBox, { backgroundColor: BROWN_MID }]}>
                    <Text style={styles.grandValue}>{formatINR(q.balance_due ?? q.total)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {!q.is_po && q.terms && q.terms.trim() !== "" && (
        <View style={styles.termsBox} wrap={false}>
          <View style={styles.termsHead}>
            <Text style={styles.termsTitle}>Terms & Conditions</Text>
          </View>
          <View style={styles.termsBody}>
            {q.terms.split(/\r?\n/).filter((l) => l.trim() !== "").map((line, idx) => {
              const m = line.match(/^\s*(\d+)[.)]\s*(.*)$/);
              return (
                <View key={idx} style={styles.termsRow}>
                  <Text style={styles.termsNum}>{m ? `${m[1]}.` : "•"}</Text>
                  <Text style={styles.termsLine}>{m ? m[2] : line}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {q.notes && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 9, color: "#6B5848" }}>Notes: {q.notes}</Text>
        </View>
      )}

      {!q.is_po && (
        <View style={{ flexDirection: "row", justifyContent: q.show_seal_sign ? "space-between" : "flex-end", alignItems: "flex-end", marginTop: 8 }} wrap={false}>
          {q.show_seal_sign && (
            <View style={{ alignItems: "center" }}>
              <Image src={sealSign} style={{ width: 130, height: 59, objectFit: "contain" }} />
              <Text style={{ fontSize: 7.5, color: BROWN, fontWeight: 700, marginTop: 2 }}>AUTHORISED SIGNATORY</Text>
            </View>
          )}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.thanksScript}>Thank You</Text>
            <View style={styles.thanksUnder} />
            <Text style={styles.thanksSub}>FOR YOUR ENQUIRY</Text>
          </View>
        </View>
      )}
    </Page>
  </Document>
);

// Fetch any image for the PDF. Order:
//  1. Our private `quotations` bucket → authenticated storage download
//     (works for old public-style URLs and expired signed URLs alike).
//  2. Plain CORS fetch (with timeout).
//  3. Server-side `image-proxy` edge function for hosts without CORS
//     (e.g. Output Books product photos).
const QUOTATIONS_RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/quotations\/([^?#]+)/;
function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}
const isImageBlob = (b: Blob | null | undefined): b is Blob =>
  !!b && b.size > 0 && (b.type.startsWith("image/") || b.type === "application/octet-stream" || b.type === "");
async function fetchImageBlob(url: string): Promise<Blob | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const m = url.match(QUOTATIONS_RE);
  if (m) {
    try {
      const { data, error } = await withTimeout(
        supabase.storage.from("quotations").download(decodeURIComponent(m[1])),
      );
      if (!error && isImageBlob(data)) return data;
      console.warn("[PDF] storage download failed", m[1], error);
    } catch (e) {
      console.warn("[PDF] storage download threw", m[1], e);
    }
  }
  try {
    const res = await withTimeout(fetch(url, { mode: "cors", credentials: "omit" }));
    if (res.ok) {
      const b = await res.blob();
      if (isImageBlob(b)) return b;
    }
  } catch {
    /* CORS / network — try proxy */
  }
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return null;
    const res = await withTimeout(
      fetch("https://ejxautrxbcemrncpzjyg.supabase.co/functions/v1/image-proxy", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }),
    );
    if (!res.ok) {
      console.warn(`[PDF] image-proxy ${res.status} for ${url}`);
      return null;
    }
    const b = await res.blob();
    return isImageBlob(b) ? b : null;
  } catch (e) {
    console.warn("[PDF] image-proxy threw", url, e);
    return null;
  }
}

// Pre-fetch a remote image and convert to data URI so @react-pdf/renderer
// never fails on CORS / 404 / slow networks. Returns null on failure.
// IMPORTANT: @react-pdf/renderer only supports JPEG and PNG — NOT WebP / AVIF.
// We always re-encode the fetched image to JPEG via canvas so PDFs render
// every photo regardless of the source format. This fixes the "no item
// photos in PDF" bug introduced when uploads started using WebP.
async function toDataUri(url: string | null, options: PdfImageOptions = {}): Promise<string | null> {
  if (!url) return null;
  // Already a data URI in a PDF-safe format (jpeg/png) — use as-is
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg") || url.startsWith("data:image/png")) {
    return url;
  }
  try {
    let blob: Blob;
    if (url.startsWith("data:")) {
      // Data URI in unsupported format (e.g. webp) — decode locally
      const res = await fetch(url);
      blob = await res.blob();
    } else {
      const b = await fetchImageBlob(url);
      if (!b) return null;
      blob = b;
    }
    // Re-encode to JPEG so @react-pdf/renderer always accepts it.
    return await blobToJpegDataUri(blob, options);
  } catch (e) {
    console.warn(`[PDF] image fetch threw for ${url}:`, e);
    return null;
  }
}

// Decode any browser-supported image (webp, avif, png, jpeg, gif) and
// re-encode it as JPEG via canvas. Returns null on failure.
async function blobToJpegDataUri(blob: Blob, options: PdfImageOptions = {}): Promise<string | null> {
  // Tighter defaults: photos render at ~44–96px in the PDF, so 900px / q=0.7
  // is visually identical to 1200px / q=0.85 but produces ~50% smaller files.
  const { maxSide = 900, jpegQuality = 0.7 } = options;
  // Even PNGs get re-encoded to JPEG — PNG payloads are typically 3–6× larger
  // than the equivalent JPEG and we don't need transparency in the PDF (white
  // page background). This is the single biggest win for compression.
  // For jpeg, webp, avif, gif → decode + re-encode as JPEG.
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new window.Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = (e) => reject(e);
      im.src = objectUrl;
    });
    // Cap longest side at 1200px — keeps PDF small and fast without
    // visibly hurting quality at the 64×64–88×88 print sizes we use.
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // White background — JPEGs have no alpha; avoids black fill on transparent webps.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", jpegQuality);
  } catch (e) {
    console.warn("[PDF] decode/re-encode failed", e);
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function generateQuotationPdf(q: QuotationPdfData, options: PdfRenderOptions = {}): Promise<Blob> {
  const imageOptions = options.image ?? {};
  const splitUrls = (raw: string | null) =>
    (raw ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  const items = await Promise.all(
    q.items.map(async (it) => {
      const measUrls = splitUrls(it.measurement_image_url);
      const catUrls = splitUrls(it.catalog_image_url);
      const siteUrls = splitUrls(it.site_photos ?? null);
      const [measDataUris, catDataUris, siteDataUris, itemUri, sketchUri] = await Promise.all([
        Promise.all(measUrls.map((u) => toDataUri(u, imageOptions))).then((arr) =>
          arr.filter((u): u is string => !!u)
        ),
        Promise.all(catUrls.map((u) => toDataUri(u, imageOptions))).then((arr) =>
          arr.filter((u): u is string => !!u)
        ),
        Promise.all(siteUrls.map((u) => toDataUri(u, imageOptions))).then((arr) =>
          arr.filter((u): u is string => !!u)
        ),
        toDataUri(firstUrl(it.item_image_url), imageOptions),
        toDataUri(it.sketch_url ?? null, imageOptions),
      ]);
      return {
        ...it,
        item_image_url: itemUri,
        measurement_image_url: measDataUris[0] ?? null,
        measurement_images: measDataUris,
        catalog_image_url: catDataUris[0] ?? null,
        catalog_images: catDataUris,
        sketch_data_uri: sketchUri,
        site_photos_data: siteDataUris,
      };
    })
  );
  const safe = { ...q, items };
  return await pdf(<QuotationDoc q={safe} />).toBlob();
}

// ===== Job Work PDF (worker-safe: NO prices, NO bank, NO customer phone) =====

// A4 usable width with 28pt page padding = 595 - 56 = 539pt
// Column widths sum to 539: SL(22) + Item(110) + Photo(90) + Measurement(130) + Catalog(130) + Qty(57)
const JW_COLS = { sl: 22, item: 110, photo: 90, meas: 130, cat: 130, qty: 57 };

const jwStyles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 28, fontFamily: "Helvetica", color: "#292522", fontSize: 10, backgroundColor: "#FFFFFF" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1.5, borderBottomColor: "#5E2D05", paddingBottom: 10, marginBottom: 12 },
  logo: { width: 100, height: 44, objectFit: "contain" },
  brandRight: { textAlign: "right" },
  brandName: { fontSize: 13, fontWeight: 700, color: "#5E2D05" },
  brandLine: { fontSize: 8, color: "#655B52", marginTop: 2 },

  hTitle: { fontSize: 17, fontWeight: 700, color: "#5E2D05", marginBottom: 10, textAlign: "center", letterSpacing: 1 },

  metaStrip: { flexDirection: "row", borderWidth: 0.75, borderColor: "#5E2D05", borderRadius: 4, marginBottom: 12 },
  metaCell: { flex: 1, padding: 8, borderRightWidth: 0.5, borderRightColor: "#5E2D05" },
  metaCellLast: { flex: 1, padding: 8 },
  metaLabel: { fontSize: 7.5, color: "#655B52", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  metaValue: { fontSize: 11, fontWeight: 700, color: "#292522" },

  table: { borderWidth: 0.75, borderColor: "#5E2D05", borderRadius: 2, marginBottom: 10 },
  tHead: { flexDirection: "row", backgroundColor: "#5E2D05" },
  th: { color: "#FFFFFF", fontSize: 9, fontWeight: 700, padding: 6, borderRightWidth: 0.5, borderRightColor: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.4 },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#5E2D05", alignItems: "stretch" },
  tRowAlt: { backgroundColor: "#FAFCFC" },
  td: { padding: 6, borderRightWidth: 0.5, borderRightColor: "#D8DEDF", justifyContent: "flex-start" },

  cellSl: { fontSize: 11, fontWeight: 700, color: "#5E2D05", textAlign: "center" },
  cellItem: { fontSize: 10, color: "#292522", lineHeight: 1.35 },
  cellQty: { fontSize: 14, fontWeight: 700, color: "#5E2D05", textAlign: "center" },

  photoBox: { width: 96, height: 96, alignSelf: "center", borderWidth: 0.5, borderColor: "#D8DEDF", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC" },
  photoImg: { width: 92, height: 92, objectFit: "contain" },
  photoEmpty: { fontSize: 7.5, color: "#9AA8AA" },

  measText: { fontSize: 10, color: "#292522", marginBottom: 4 },
  sketchLabel: { fontSize: 7, color: "#655B52", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2, marginBottom: 2 },
  sketchBox: { width: "100%", height: 80, borderWidth: 0.5, borderColor: "#D8DEDF", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC" },
  sketchImg: { width: 178, height: 76, objectFit: "contain" },

  notesBox: { marginTop: 8, padding: 8, borderWidth: 0.5, borderColor: "#D8DEDF", borderRadius: 4, backgroundColor: "#FAFCFC" },
  notesTitle: { fontSize: 9, fontWeight: 700, color: "#5E2D05", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  notesText: { fontSize: 9.5, color: "#292522", lineHeight: 1.4 },

  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  signCol: { width: 180, alignItems: "center" },
  signLine: { borderTopWidth: 0.75, borderTopColor: "#292522", width: "100%", marginBottom: 4 },
  signLabel: { fontSize: 8.5, color: "#655B52", textTransform: "uppercase", letterSpacing: 0.6 },

  footer: { position: "absolute", bottom: 18, left: 28, right: 28, textAlign: "center", fontSize: 7.5, color: "#655B52", borderTopWidth: 0.5, borderTopColor: "#D8DEDF", paddingTop: 5 },
  pageNo: { position: "absolute", bottom: 6, right: 28, fontSize: 7.5, color: "#9AA8AA" },
});

export type JobWorkPdfData = {
  quotation_id: string;
  customer_name?: string | null;
  customer_place?: string | null;
  worker_name: string;
  date: string;
  required_by?: string | null;
  notes: string | null;
  items: {
    description: string;
    item_notes?: string | null;
    item_image_url: string | null;
    measurement: string | null;
    measurement_image_url: string | null;
    catalog_text: string | null;
    catalog_image_url: string | null;
    sketch_url?: string | null;
    site_photos?: string | null;
    /** Set internally during PDF generation: list of data-URI sketches/cloth refs. */
    measurement_images?: string[];
    catalog_images?: string[];
    sketch_data_uri?: string | null;
    site_photos_data?: string[];
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
          <Text style={jwStyles.metaLabel}>Customer</Text>
          <Text style={jwStyles.metaValue}>{d.customer_name || "-"}</Text>
          <Text style={[jwStyles.metaLabel, { marginTop: 5 }]}>Place</Text>
          <Text style={jwStyles.metaValue}>{d.customer_place || "-"}</Text>
        </View>
        <View style={jwStyles.metaCell}>
          <Text style={jwStyles.metaLabel}>Quotation</Text>
          <Text style={jwStyles.metaValue}>{d.quotation_id}</Text>
          <Text style={[jwStyles.metaLabel, { marginTop: 5 }]}>Assigned Date</Text>
          <Text style={jwStyles.metaValue}>{d.date}</Text>
        </View>
        <View style={jwStyles.metaCellLast}>
          <Text style={jwStyles.metaLabel}>Required By</Text>
          <Text style={jwStyles.metaValue}>{d.required_by || "-"}</Text>
          <Text style={[jwStyles.metaLabel, { marginTop: 5 }]}>Worker</Text>
          <Text style={jwStyles.metaValue}>{d.worker_name}</Text>
        </View>
      </View>

      <View style={jwStyles.table}>
        <View style={jwStyles.tHead} fixed>
          <Text style={[jwStyles.th, { width: JW_COLS.sl, textAlign: "center" }]}>SL</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.item }]}>Item</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.photo, textAlign: "center" }]}>Photo</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.meas }]}>Measurement</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.cat }]}>Catalog</Text>
          <Text style={[jwStyles.th, { width: JW_COLS.qty, textAlign: "center", borderRightWidth: 0 }]}>Qty</Text>
        </View>

        {d.items.map((it, i) => (
          <View key={i} style={[jwStyles.tRow, i % 2 === 1 ? jwStyles.tRowAlt : {}]} wrap={false}>
            <View style={[jwStyles.td, { width: JW_COLS.sl, justifyContent: "center" }]}>
              <Text style={jwStyles.cellSl}>{i + 1}</Text>
            </View>
            <View style={[jwStyles.td, { width: JW_COLS.item }]}>
              <View style={jwStyles.cellItem}>
                <Text>{it.description || "-"}</Text>
                {it.item_notes?.trim() ? (
                  <Text style={{ marginTop: 3, fontSize: 8.5, color: "#52666A", lineHeight: 1.35 }}>{it.item_notes}</Text>
                ) : null}
              </View>
            </View>
            <View style={[jwStyles.td, { width: JW_COLS.photo, justifyContent: "center" }]}>
              <View style={[jwStyles.photoBox, { width: 80, height: 80 }]}>
                {it.item_image_url && it.item_image_url.startsWith("data:") ? (
                  <Image src={it.item_image_url} style={{ width: 76, height: 76, objectFit: "contain" }} />
                ) : (
                  <Text style={jwStyles.photoEmpty}>No photo</Text>
                )}
              </View>
            </View>
            <View style={[jwStyles.td, { width: JW_COLS.meas }]}>
              {it.measurement ? (
                <Text style={jwStyles.measText}>{it.measurement}</Text>
              ) : (
                (it.measurement_images ?? []).filter((s) => s && s.startsWith("data:")).length === 0 && <Text style={[jwStyles.measText, { color: "#9AA8AA" }]}>-</Text>
              )}
              {(it.measurement_images ?? []).filter((s) => s && s.startsWith("data:")).length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
                  {(it.measurement_images ?? []).filter((s) => s && s.startsWith("data:")).map((src, k) => (
                    <View key={k} style={{ width: 58, height: 58, borderWidth: 0.5, borderColor: "#D8DEDF", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC" }}>
                      <Image src={src} style={{ width: 54, height: 54, objectFit: "contain" }} />
                    </View>
                  ))}
                </View>
              )}
              {it.sketch_data_uri && (
                <View style={{ marginTop: 4 }}>
                  <Text style={jwStyles.sketchLabel}>Sketch</Text>
                  <View style={jwStyles.sketchBox}>
                    <Image src={it.sketch_data_uri} style={jwStyles.sketchImg} />
                  </View>
                </View>
              )}
              {(it.site_photos_data ?? []).length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={jwStyles.sketchLabel}>Site photos</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
                    {(it.site_photos_data ?? []).map((src, k) => (
                      <View key={`site-${k}`} style={{ width: 58, height: 58, borderWidth: 0.5, borderColor: "#D8DEDF", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC" }}>
                        <Image src={src} style={{ width: 54, height: 54, objectFit: "contain" }} />
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
            <View style={[jwStyles.td, { width: JW_COLS.cat }]}>
              {it.catalog_text ? (
                <Text style={jwStyles.measText}>{it.catalog_text}</Text>
              ) : (
                (it.catalog_images ?? []).filter((s) => s && s.startsWith("data:")).length === 0 && <Text style={[jwStyles.measText, { color: "#9AA8AA" }]}>-</Text>
              )}
              {(it.catalog_images ?? []).filter((s) => s && s.startsWith("data:")).length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
                  {(it.catalog_images ?? []).filter((s) => s && s.startsWith("data:")).map((src, k) => (
                    <View key={k} style={{ width: 58, height: 58, borderWidth: 0.5, borderColor: "#D8DEDF", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFC" }}>
                      <Image src={src} style={{ width: 54, height: 54, objectFit: "contain" }} />
                    </View>
                  ))}
                </View>
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

export async function generateJobWorkPdf(d: JobWorkPdfData, options: PdfRenderOptions = {}): Promise<Blob> {
  const imageOptions = options.image ?? {};
  const splitUrls = (raw: string | null) =>
    (raw ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  const items = await Promise.all(
    d.items.map(async (it) => {
      const measUrls = splitUrls(it.measurement_image_url);
      const catUrls = splitUrls(it.catalog_image_url);
      const siteUrls = splitUrls(it.site_photos ?? null);
      const [measDataUris, catDataUris, siteDataUris, itemUri, sketchUri] = await Promise.all([
        Promise.all(measUrls.map((u) => toDataUri(u, imageOptions))).then((arr) =>
          arr.filter((u): u is string => !!u)
        ),
        Promise.all(catUrls.map((u) => toDataUri(u, imageOptions))).then((arr) =>
          arr.filter((u): u is string => !!u)
        ),
        Promise.all(siteUrls.map((u) => toDataUri(u, imageOptions))).then((arr) =>
          arr.filter((u): u is string => !!u)
        ),
        toDataUri(firstUrl(it.item_image_url), imageOptions),
        toDataUri(it.sketch_url ?? null, imageOptions),
      ]);
      return {
        ...it,
        item_image_url: itemUri,
        measurement_image_url: measDataUris[0] ?? null,
        measurement_images: measDataUris,
        catalog_image_url: catDataUris[0] ?? null,
        catalog_images: catDataUris,
        sketch_data_uri: sketchUri,
        site_photos_data: siteDataUris,
      };
    })
  );
  const safe = { ...d, items };
  return await pdf(<JobWorkDoc d={safe} />).toBlob();
}
