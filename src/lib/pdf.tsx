import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer";
import logo from "@/assets/hitech-logo.jpeg";
import { CONTACT_LINE } from "./brand";

// PDF-safe INR formatter: Helvetica doesn't include the ₹ glyph, which
// renders as a tiny box / phantom "1" in many PDF viewers. Use plain
// "Rs " prefix with Indian digit grouping for clean output.
const formatINR = (n: number | null | undefined) => {
  if (n == null) return "-";
  const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
  return `Rs ${num}`;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", color: "#0F2A2E", backgroundColor: "#FBF8F2" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottom: "1pt solid #0E5C66", paddingBottom: 12, marginBottom: 18 },
  logo: { width: 110, height: 50, objectFit: "contain" },
  brandLine: { fontSize: 9, color: "#0E5C66", letterSpacing: 1, textTransform: "uppercase" },
  // Use "contain" so the entire furniture item is visible — no cropping/cut-off.
  hero: { width: "100%", height: 280, objectFit: "contain", marginBottom: 18, borderRadius: 4 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#0E5C66" },
  code: { fontSize: 9, color: "#6E7F82", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 },
  desc: { fontSize: 11, lineHeight: 1.6, marginBottom: 16, color: "#1F3F44" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  label: { fontSize: 9, color: "#6E7F82", textTransform: "uppercase", letterSpacing: 1 },
  value: { fontSize: 12, color: "#0F2A2E", fontWeight: 600 },
  priceBlock: { backgroundColor: "#0E5C66", color: "#FBF8F2", padding: 14, borderRadius: 6, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontSize: 9, color: "#FBF8F2", letterSpacing: 1.2, textTransform: "uppercase" },
  price: { fontSize: 22, color: "#FBF8F2", fontWeight: 700 },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  colorChip: { fontSize: 9, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "#F4A227", color: "#0F2A2E", borderRadius: 12 },
  footer: { position: "absolute", bottom: 30, left: 36, right: 36, textAlign: "center", fontSize: 9, color: "#6E7F82", borderTop: "1pt solid #0E5C66", paddingTop: 8 },
});

type PdfProduct = {
  product_name: string;
  product_code: string;
  description: string | null;
  mrp: number;
  offer_price: number | null;
  available_colors: string[] | null;
  material: string | null;
  dimensions: string | null;
  cover_image: string | null;
};

const Brochure = ({ p }: { p: PdfProduct }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Image src={logo} style={styles.logo} />
        <Text style={styles.brandLine}>Furniture & Interiors</Text>
      </View>
      {p.cover_image && <Image src={p.cover_image} style={styles.hero} />}
      <Text style={styles.title}>{p.product_name}</Text>
      <Text style={styles.code}>Code · {p.product_code}</Text>
      {p.description && <Text style={styles.desc}>{p.description}</Text>}

      <View style={styles.priceBlock}>
        <View>
          <Text style={styles.priceLabel}>MRP</Text>
          {p.offer_price && p.offer_price < p.mrp ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={styles.price}>{formatINR(p.offer_price)}</Text>
              <Text style={{ fontSize: 11, color: "#FBF8F2", textDecoration: "line-through" }}>{formatINR(p.mrp)}</Text>
            </View>
          ) : (
            <Text style={styles.price}>{formatINR(p.mrp)}</Text>
          )}
        </View>
        <Text style={styles.priceLabel}>Inclusive of taxes</Text>
      </View>

      {p.material && (
        <View style={styles.row}>
          <Text style={styles.label}>Material</Text>
          <Text style={styles.value}>{p.material}</Text>
        </View>
      )}
      {p.dimensions && (
        <View style={styles.row}>
          <Text style={styles.label}>Dimensions</Text>
          <Text style={styles.value}>{p.dimensions}</Text>
        </View>
      )}
      {p.available_colors && p.available_colors.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.label}>Available Colors</Text>
          <View style={styles.colors}>
            {p.available_colors.map((c) => (
              <Text key={c} style={styles.colorChip}>{c}</Text>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.footer}>{CONTACT_LINE}  ·  Generated catalog brochure</Text>
    </Page>
  </Document>
);

export async function generateProductPdf(p: PdfProduct): Promise<Blob> {
  const doc = <Brochure p={p} />;
  return await pdf(doc).toBlob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
