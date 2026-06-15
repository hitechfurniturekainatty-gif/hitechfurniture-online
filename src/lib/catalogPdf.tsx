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
  stock_quantity?: number;
  stock_status?: "in_stock" | "out_of_stock";
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

/* ============================================================
 * Structured catalog (Main category → Sub-category → Products)
 * Premium cover, banner pages, 2x2 product grid (4/page).
 * ============================================================ */

export type StructuredSubSection = {
  sub_name: string;
  sub_banner: string | null;
  items: CatalogPdfItem[];
};

export type StructuredMainSection = {
  main_name: string;
  main_banner: string | null;
  subs: StructuredSubSection[];
};

export type StructuredCatalogCover = {
  title: string;
  brand_name: string;
  tagline: string | null;
  about: string | null;
  contact_lines: string[]; // e.g. ["+91 …", "hello@…", "Wayanad, Kerala"]
};

/**
 * Pre-fetch a remote image URL and convert it to a data URL so
 * @react-pdf/renderer can embed it reliably (avoids CORS / async hiccups
 * where network images silently fail to render).
 */
async function urlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const absoluteUrl =
      typeof window !== "undefined" && url.startsWith("/")
        ? new URL(url, window.location.origin).toString()
        : url;
    const res = await fetch(absoluteUrl, { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (typeof document === "undefined") {
      return await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = document.createElement("img");
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Image decode failed"));
        el.src = objectUrl;
      });
      const maxEdge = 1200;
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.84);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/**
 * Walk the structured tree and resolve every image_url → data URL in
 * parallel (de-duplicated). Returns a new tree with the resolved URLs.
 */
export async function resolveCatalogImages(
  sections: StructuredMainSection[],
): Promise<StructuredMainSection[]> {
  const urls = new Set<string>();
  for (const m of sections) {
    if (m.main_banner) urls.add(m.main_banner);
    for (const s of m.subs) {
      if (s.sub_banner) urls.add(s.sub_banner);
      for (const it of s.items) if (it.cover_image) urls.add(it.cover_image);
    }
  }
  const urlList = Array.from(urls);
  const resolvedEntries: [string, string | null][] = [];
  const batchSize = 8;
  for (let i = 0; i < urlList.length; i += batchSize) {
    const batch = await Promise.all(
      urlList.slice(i, i + batchSize).map(async (u) => [u, await urlToDataUrl(u)] as [string, string | null]),
    );
    resolvedEntries.push(...batch);
  }
  const map = new Map(resolvedEntries);
  const swap = (u: string | null) => (u ? map.get(u) ?? u : null);
  return sections.map((m) => ({
    ...m,
    main_banner: swap(m.main_banner),
    subs: m.subs.map((s) => ({
      ...s,
      sub_banner: swap(s.sub_banner),
      items: s.items.map((it) => ({ ...it, cover_image: swap(it.cover_image) })),
    })),
  }));
}

const cs = StyleSheet.create({
  page: { padding: 28, paddingBottom: 44, fontFamily: "Helvetica", color: "#0F2A2E", backgroundColor: "#FBF8F2" },
  // Cover
  coverPage: { padding: 0, fontFamily: "Helvetica", color: "#0F2A2E", backgroundColor: "#FBF8F2" },
  coverBand: { backgroundColor: "#0E5C66", height: 140, paddingHorizontal: 36, paddingTop: 36, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  coverLogo: { width: 110, height: 50, objectFit: "contain", backgroundColor: "#FBF8F2", padding: 4, borderRadius: 4 },
  coverBandRight: { fontSize: 9, color: "#EFE7D4", letterSpacing: 2, textTransform: "uppercase", marginTop: 14 },
  coverBody: { paddingHorizontal: 48, paddingTop: 56 },
  coverEyebrow: { fontSize: 10, color: "#F4A227", letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 },
  coverTitle: { fontSize: 40, color: "#0E5C66", fontWeight: 700, marginBottom: 10, lineHeight: 1.15 },
  coverBrand: { fontSize: 16, color: "#1F3F44", marginBottom: 6 },
  coverTagline: { fontSize: 11, color: "#6E7F82", fontStyle: "italic", marginBottom: 32 },
  coverDivider: { height: 1, backgroundColor: "#0E5C66", opacity: 0.25, marginVertical: 16, width: 80 },
  coverAboutLabel: { fontSize: 9, color: "#0E5C66", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 },
  coverAbout: { fontSize: 11, color: "#1F3F44", lineHeight: 1.55, marginBottom: 36 },
  coverContactBlock: { borderTop: "1pt solid #0E5C66", paddingTop: 14, marginTop: 18 },
  coverContactLabel: { fontSize: 9, color: "#0E5C66", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 },
  coverContactLine: { fontSize: 10, color: "#1F3F44", marginBottom: 2 },
  coverFooterBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 24, backgroundColor: "#F4A227" },

  // Page chrome
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottom: "1pt solid #0E5C66", paddingBottom: 8, marginBottom: 14 },
  headerLogo: { width: 70, height: 28, objectFit: "contain" },
  headerCrumb: { fontSize: 9, color: "#0E5C66", letterSpacing: 1.5, textTransform: "uppercase" },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", borderTop: "1pt solid #0E5C66", paddingTop: 6 },
  footerText: { fontSize: 8, color: "#6E7F82" },

  // Main category banner page
  mainBannerWrap: { marginTop: 30, alignItems: "center" },
  mainBannerImg: { width: "100%", height: 320, objectFit: "cover", borderRadius: 6 },
  mainBannerPlaceholder: { width: "100%", height: 320, backgroundColor: "#EFE7D4", borderRadius: 6, alignItems: "center", justifyContent: "center" },
  mainBannerEyebrow: { fontSize: 10, color: "#F4A227", letterSpacing: 4, textTransform: "uppercase", marginTop: 28, marginBottom: 8, textAlign: "center" },
  mainBannerTitle: { fontSize: 30, color: "#0E5C66", fontWeight: 700, textAlign: "center", marginBottom: 6 },
  mainBannerMeta: { fontSize: 10, color: "#6E7F82", textAlign: "center" },

  // Sub-category header
  subWrap: { marginBottom: 12 },
  subBannerImg: { width: "100%", height: 90, objectFit: "cover", borderRadius: 4, marginBottom: 8 },
  subHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#EFE7D4", borderLeft: "3pt solid #F4A227", paddingVertical: 6, paddingHorizontal: 10, marginBottom: 10 },
  subTitle: { fontSize: 14, fontWeight: 700, color: "#0E5C66" },
  subMeta: { fontSize: 9, color: "#6E7F82" },

  // 10-product grid: 2 columns x 5 rows per product page
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  card: { width: "50%", padding: 3 },
  cardInner: { border: "1pt solid #E5DFD2", borderRadius: 5, padding: 7, backgroundColor: "#FFFFFF", height: 118 },
  imgBox: { width: "100%", height: 50, backgroundColor: "#F4F1EA", borderRadius: 3, marginBottom: 5, alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%", objectFit: "contain" },
  imgPlaceholder: { fontSize: 7, color: "#A8B1B3" },
  name: { fontSize: 8.5, fontWeight: 700, color: "#0E5C66", marginBottom: 1, lineHeight: 1.15 },
  code: { fontSize: 6.5, color: "#6E7F82", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  price: { fontSize: 8.5, fontWeight: 700, color: "#0E5C66" },
  mrp: { fontSize: 6.5, color: "#6E7F82", textDecoration: "line-through" },
  meta: { fontSize: 6.5, color: "#1F3F44", marginTop: 1.5 },
});

const PER_GRID = 10; // 2 x 5

const PageChrome = ({ crumb, footerLine }: { crumb: string; footerLine: string }) => (
  <>
    <View style={cs.header} fixed>
      <Image src={logo} style={cs.headerLogo} />
      <Text style={cs.headerCrumb}>{crumb}</Text>
    </View>
    <View style={cs.footer} fixed>
      <Text style={cs.footerText}>{footerLine}</Text>
      <Text
        style={cs.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  </>
);

const ProductCard = ({ p }: { p: CatalogPdfItem }) => {
  const onOffer = p.offer_price != null && p.offer_price < p.mrp;
  return (
    <View style={cs.card} wrap={false}>
      <View style={cs.cardInner}>
        <View style={cs.imgBox}>
          {p.cover_image ? (
            <Image src={p.cover_image} style={cs.img} />
          ) : (
            <Text style={cs.imgPlaceholder}>No image</Text>
          )}
        </View>
        <Text style={cs.name}>{p.product_name}</Text>
        <Text style={cs.code}>Code · {p.product_code}</Text>
        <View style={cs.priceRow}>
          <Text style={cs.price}>{formatINR(onOffer ? p.offer_price : p.mrp)}</Text>
          {onOffer && <Text style={cs.mrp}>{formatINR(p.mrp)}</Text>}
        </View>
        {p.material && <Text style={cs.meta}>Material: {p.material}</Text>}
        {p.dimensions && <Text style={cs.meta}>Size: {p.dimensions}</Text>}
      </View>
    </View>
  );
};

const StructuredCatalogDoc = ({
  cover,
  sections,
  footerLine,
}: {
  cover: StructuredCatalogCover;
  sections: StructuredMainSection[];
  footerLine: string;
}) => {
  const totalItems = sections.reduce((sum, m) => sum + m.subs.reduce((a, s) => a + s.items.length, 0), 0);
  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={cs.coverPage}>
        <View style={cs.coverBand}>
          <Image src={logo} style={cs.coverLogo} />
          <Text style={cs.coverBandRight}>Furniture & Interiors</Text>
        </View>
        <View style={cs.coverBody}>
          <Text style={cs.coverEyebrow}>Product Catalog</Text>
          <Text style={cs.coverTitle}>{cover.title}</Text>
          <Text style={cs.coverBrand}>{cover.brand_name}</Text>
          {cover.tagline && <Text style={cs.coverTagline}>{cover.tagline}</Text>}
          <View style={cs.coverDivider} />
          {cover.about && (
            <>
              <Text style={cs.coverAboutLabel}>About Us</Text>
              <Text style={cs.coverAbout}>{cover.about}</Text>
            </>
          )}
          <Text style={{ fontSize: 10, color: "#6E7F82", marginBottom: 4 }}>
            {sections.length} categor{sections.length === 1 ? "y" : "ies"} · {totalItems} pieces
          </Text>
          <View style={cs.coverContactBlock}>
            <Text style={cs.coverContactLabel}>Get in touch</Text>
            {cover.contact_lines.map((l, i) => (
              <Text key={i} style={cs.coverContactLine}>{l}</Text>
            ))}
          </View>
        </View>
        <View style={cs.coverFooterBar} />
      </Page>

      {sections.map((main, mi) => {
        const mainItemCount = main.subs.reduce((a, s) => a + s.items.length, 0);
        return (
          <>
            {/* Main category banner page */}
            <Page key={`mb-${mi}`} size="A4" style={cs.page}>
              <PageChrome crumb={main.main_name} footerLine={footerLine} />
              {main.main_banner ? (
                <Image src={main.main_banner} style={cs.mainBannerImg} />
              ) : (
                <View style={cs.mainBannerPlaceholder}>
                  <Text style={{ fontSize: 28, color: "#0E5C66", fontWeight: 700 }}>{main.main_name}</Text>
                </View>
              )}
              <Text style={cs.mainBannerEyebrow}>Main Category</Text>
              <Text style={cs.mainBannerTitle}>{main.main_name}</Text>
              <Text style={cs.mainBannerMeta}>
                {main.subs.length} sub-categor{main.subs.length === 1 ? "y" : "ies"} · {mainItemCount} pieces
              </Text>
            </Page>

            {/* Each sub-category: header + 2x2 grids */}
            {main.subs.map((sub, si) => {
              const pages: CatalogPdfItem[][] = [];
              for (let i = 0; i < sub.items.length; i += PER_GRID) {
                pages.push(sub.items.slice(i, i + PER_GRID));
              }
              if (pages.length === 0) pages.push([]);
              return pages.map((chunk, pi) => (
                <Page key={`s-${mi}-${si}-${pi}`} size="A4" style={cs.page}>
                  <PageChrome crumb={`${main.main_name} › ${sub.sub_name}`} footerLine={footerLine} />
                  {pi === 0 && (
                    <View style={cs.subWrap}>
                      {sub.sub_banner && <Image src={sub.sub_banner} style={cs.subBannerImg} />}
                      <View style={cs.subHeaderRow}>
                        <Text style={cs.subTitle}>{sub.sub_name}</Text>
                        <Text style={cs.subMeta}>
                          {sub.items.length} item{sub.items.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </View>
                  )}
                  {chunk.length === 0 ? (
                    <Text style={{ fontSize: 10, color: "#6E7F82", marginTop: 20 }}>
                      No products in this sub-category.
                    </Text>
                  ) : (
                    <View style={cs.grid}>
                      {chunk.map((p, i) => (
                        <ProductCard key={i} p={p} />
                      ))}
                    </View>
                  )}
                </Page>
              ));
            })}
          </>
        );
      })}
    </Document>
  );
};

export async function generateStructuredCatalogPdf(
  sections: StructuredMainSection[],
  cover: StructuredCatalogCover,
  footerLine: string = CONTACT_LINE,
): Promise<Blob> {
  // Resolve all images (banners + product covers) to data URLs first so
  // @react-pdf/renderer never has to fetch over the network mid-render.
  const resolved = await resolveCatalogImages(sections);
  const doc = (
    <StructuredCatalogDoc cover={cover} sections={resolved} footerLine={footerLine} />
  );
  return await pdf(doc).toBlob();
}