import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer";
import logo from "@/assets/hitech-logo.jpeg";
import { CONTACT_LINE } from "./brand";

/**
 * Multi-product catalog brochure. Lazy-loaded from the Catalog page so the
 * heavy @react-pdf/renderer chunk never blocks first paint.
 */

const formatINR = (n: number | null | undefined) => {
  if (n == null) return "-";
  return `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
};

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", color: "#0F2A2E", backgroundColor: "#FBF8F2" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottom: "1pt solid #0E5C66", paddingBottom: 10, marginBottom: 14 },
  logo: { width: 90, height: 40, objectFit: "contain" },
  brandLine: { fontSize: 9, color: "#0E5C66", letterSpacing: 1, textTransform: "uppercase" },
  coverWrap: { alignItems: "center", justifyContent: "center", height: 700 },
  coverTitle: { fontSize: 36, color: "#0E5C66", fontWeight: 700, textAlign: "center", marginBottom: 8 },
  coverSub: { fontSize: 13, color: "#1F3F44", textAlign: "center", marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  card: { width: "50%", padding: 6 },
  cardInner: { border: "1pt solid #E5DFD2", borderRadius: 6, padding: 10, backgroundColor: "#FFFFFF" },
  img: { width: "100%", height: 150, objectFit: "contain", marginBottom: 8 },
  name: { fontSize: 11, fontWeight: 700, color: "#0E5C66", marginBottom: 2 },
  code: { fontSize: 8, color: "#6E7F82", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  price: { fontSize: 12, fontWeight: 700, color: "#0E5C66" },
  mrp: { fontSize: 8, color: "#6E7F82", textDecoration: "line-through" },
  meta: { fontSize: 8, color: "#1F3F44", marginTop: 3 },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, textAlign: "center", fontSize: 8, color: "#6E7F82", borderTop: "1pt solid #0E5C66", paddingTop: 6 },
  pageLabel: { position: "absolute", bottom: 16, right: 28, fontSize: 8, color: "#6E7F82" },
});

export type CatalogPdfItem = {
  product_name: string;
  product_code: string;
  mrp: number;
  offer_price: number | null;
  material: string | null;
  dimensions: string | null;
  cover_image: string | null;
};

const PER_PAGE = 6; // 2 cols x 3 rows

const CatalogDoc = ({ items, title, subtitle }: { items: CatalogPdfItem[]; title: string; subtitle: string }) => {
  const pages: CatalogPdfItem[][] = [];
  for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image src={logo} style={s.logo} />
          <Text style={s.brandLine}>Furniture & Interiors</Text>
        </View>
        <View style={s.coverWrap}>
          <Text style={s.coverTitle}>{title}</Text>
          <Text style={s.coverSub}>{subtitle}</Text>
          <Text style={{ fontSize: 11, color: "#6E7F82" }}>{items.length} pieces in this catalog</Text>
        </View>
        <Text style={s.footer}>{CONTACT_LINE}</Text>
      </Page>

      {/* Product pages */}
      {pages.map((chunk, pi) => (
        <Page key={pi} size="A4" style={s.page}>
          <View style={s.header}>
            <Image src={logo} style={s.logo} />
            <Text style={s.brandLine}>{title}</Text>
          </View>
          <View style={s.grid}>
            {chunk.map((p, i) => {
              const onOffer = p.offer_price != null && p.offer_price < p.mrp;
              return (
                <View key={i} style={s.card} wrap={false}>
                  <View style={s.cardInner}>
                    {p.cover_image && <Image src={p.cover_image} style={s.img} />}
                    <Text style={s.name}>{p.product_name}</Text>
                    <Text style={s.code}>Code · {p.product_code}</Text>
                    <View style={s.priceRow}>
                      <Text style={s.price}>{formatINR(onOffer ? p.offer_price : p.mrp)}</Text>
                      {onOffer && <Text style={s.mrp}>{formatINR(p.mrp)}</Text>}
                    </View>
                    {p.material && <Text style={s.meta}>Material: {p.material}</Text>}
                    {p.dimensions && <Text style={s.meta}>Size: {p.dimensions}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={s.footer}>{CONTACT_LINE}</Text>
          <Text style={s.pageLabel}>Page {pi + 1} / {pages.length}</Text>
        </Page>
      ))}
    </Document>
  );
};

export async function generateCatalogPdf(items: CatalogPdfItem[], title: string, subtitle: string): Promise<Blob> {
  const doc = <CatalogDoc items={items} title={title} subtitle={subtitle} />;
  return await pdf(doc).toBlob();
}

/* ---------- Section-wise (category grouped) catalog ---------- */

export type CatalogPdfSection = {
  name: string;
  items: CatalogPdfItem[];
};

const sectionStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0E5C66",
    backgroundColor: "#EFE7D4",
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderLeft: "3pt solid #F4A227",
  },
  sectionMeta: { fontSize: 9, color: "#6E7F82", marginBottom: 8 },
});

const SectionedCatalogDoc = ({
  sections,
  title,
  subtitle,
}: {
  sections: CatalogPdfSection[];
  title: string;
  subtitle: string;
}) => {
  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image src={logo} style={s.logo} />
          <Text style={s.brandLine}>Furniture & Interiors</Text>
        </View>
        <View style={s.coverWrap}>
          <Text style={s.coverTitle}>{title}</Text>
          <Text style={s.coverSub}>{subtitle}</Text>
          <Text style={{ fontSize: 11, color: "#6E7F82" }}>
            {sections.length} sections · {totalItems} pieces
          </Text>
        </View>
        <Text style={s.footer}>{CONTACT_LINE}</Text>
      </Page>

      {sections.map((section, si) => {
        const pages: CatalogPdfItem[][] = [];
        for (let i = 0; i < section.items.length; i += PER_PAGE) {
          pages.push(section.items.slice(i, i + PER_PAGE));
        }
        if (pages.length === 0) pages.push([]);
        return pages.map((chunk, pi) => (
          <Page key={`${si}-${pi}`} size="A4" style={s.page}>
            <View style={s.header}>
              <Image src={logo} style={s.logo} />
              <Text style={s.brandLine}>{title}</Text>
            </View>
            {pi === 0 && (
              <>
                <Text style={sectionStyles.sectionHeader}>{section.name}</Text>
                <Text style={sectionStyles.sectionMeta}>{section.items.length} item{section.items.length === 1 ? "" : "s"}</Text>
              </>
            )}
            {chunk.length === 0 ? (
              <Text style={{ fontSize: 10, color: "#6E7F82", marginTop: 20 }}>No items in this section.</Text>
            ) : (
              <View style={s.grid}>
                {chunk.map((p, i) => {
                  const onOffer = p.offer_price != null && p.offer_price < p.mrp;
                  return (
                    <View key={i} style={s.card} wrap={false}>
                      <View style={s.cardInner}>
                        {p.cover_image && <Image src={p.cover_image} style={s.img} />}
                        <Text style={s.name}>{p.product_name}</Text>
                        <Text style={s.code}>Code · {p.product_code}</Text>
                        <View style={s.priceRow}>
                          <Text style={s.price}>{formatINR(onOffer ? p.offer_price : p.mrp)}</Text>
                          {onOffer && <Text style={s.mrp}>{formatINR(p.mrp)}</Text>}
                        </View>
                        {p.material && <Text style={s.meta}>Material: {p.material}</Text>}
                        {p.dimensions && <Text style={s.meta}>Size: {p.dimensions}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            <Text style={s.footer}>{CONTACT_LINE}</Text>
            <Text style={s.pageLabel}>{section.name} · {pi + 1} / {pages.length}</Text>
          </Page>
        ));
      })}
    </Document>
  );
};

export async function generateSectionedCatalogPdf(
  sections: CatalogPdfSection[],
  title: string,
  subtitle: string,
): Promise<Blob> {
  const doc = <SectionedCatalogDoc sections={sections} title={title} subtitle={subtitle} />;
  return await pdf(doc).toBlob();
}