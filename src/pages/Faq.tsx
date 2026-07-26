import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Seo } from "@/components/Seo";
import { SEO_BRAND_NAME } from "@/lib/localBusinessSchema";

// Kept in sync with GENERAL_FAQ in scripts/generate-crawler-snapshots.mjs —
// deliberately states only facts we can stand behind. Update both places
// together when warranty/EMI/delivery specifics get confirmed for publishing.
const FAQ_ITEMS = [
  {
    q: "Where is Hitech Furniture & Interiors located?",
    a: "Hitech Furniture & Interiors is located in Edappetty, Kalpetta, Wayanad, Kerala. The showroom serves customers across Wayanad district and beyond.",
  },
  {
    q: "What does Hitech Furniture & Interiors sell?",
    a: "Hitech Furniture & Interiors sells sofas, beds, wardrobes, dining sets, chairs and other home furniture, and also offers custom interior design and wholesale furniture supply, across 37 product categories.",
  },
  {
    q: "How can I get a price quote or place an enquiry?",
    a: "You can browse the live catalog and send a product enquiry directly on WhatsApp for pricing, availability and delivery details.",
  },
  {
    q: "How long has Hitech Furniture & Interiors been operating?",
    a: "Hitech Furniture & Interiors has been operating in Wayanad, Kerala for over 14 years.",
  },
  {
    q: "Is EMI available?",
    a: "Yes, EMI is available through Bajaj Finserv on eligible purchases. Ask in-store or on WhatsApp for current terms.",
  },
  {
    q: "Is there a warranty on furniture?",
    a: "Locally manufactured wooden furniture carries a 10-year warranty against termite and wood-borer damage (original bill required; does not cover physical damage). Ask about the specific item's warranty before purchase.",
  },
];

const Faq = () => (
  <>
    <Seo
      title={`Frequently Asked Questions — ${SEO_BRAND_NAME}`}
      description="Answers about location, product range, pricing, EMI and warranty for Hitech Furniture & Interiors, Kalpetta, Wayanad."
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }}
    />
    <SiteHeader />
    <main className="container-page py-12 md:py-16">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl md:text-5xl">Frequently Asked Questions</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Common questions about {SEO_BRAND_NAME}, Kalpetta, Wayanad.
        </p>
      </header>
      <div className="mx-auto mt-10 max-w-3xl space-y-6">
        {FAQ_ITEMS.map((f) => (
          <div key={f.q} className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
            <h2 className="font-display text-xl text-foreground">{f.q}</h2>
            <p className="mt-2 text-base leading-relaxed text-foreground/80">{f.a}</p>
          </div>
        ))}
      </div>
    </main>
    <SiteFooter />
  </>
);

export default Faq;
