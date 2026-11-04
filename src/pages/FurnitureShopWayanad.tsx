import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Seo } from "@/components/Seo";
import { LOCAL_BUSINESS_JSONLD } from "@/lib/localBusinessSchema";
import { openEnquiryForm } from "@/lib/enquiryForm";
import { MapPin, Phone, Clock } from "lucide-react";

const RANGE = [
  { title: "Sofas & living room", text: "Sofa sets, recliners, centre tables, TV units and shoe racks in fabric, leatherette and wood." },
  { title: "Beds, cots & mattresses", text: "Wooden and steel cots, storage beds and branded mattresses: Kurlon, Repose, Peps, Modo and local makes." },
  { title: "Dining sets", text: "4, 6 and 8 seater dining tables and chairs, from budget sets to solid wood." },
  { title: "Wardrobes & storage", text: "Wardrobes, dressing tables, shelves and cupboards, ready-made or made to your size." },
  { title: "Custom furniture", text: "Furniture built to your measurement, finish and budget by our own workers." },
  { title: "Complete interiors", text: "Living room, bedroom and kitchen interiors, from planning to installation." },
];

const FAQS = [
  { q: "Where is Hitech Furniture in Kalpetta?", a: "Edapetty Shopping Centre, Edapetty, Kalpetta, Wayanad - 673122, on the Kalpetta–Bathery road. Open the Google Maps pin from this page for exact directions." },
  { q: "Do you have furniture for every budget?", a: "Yes. We stock budget, mid-range and premium furniture and mattresses. Tell us your budget and we will show suitable options." },
  { q: "Do you deliver outside Wayanad?", a: "Yes. We deliver across Wayanad and Malabar, and to Bengaluru and Tamil Nadu on request." },
  { q: "Can you make furniture to my size?", a: "Yes. Cots, wardrobes, sofas and dining sets can be made to your size, finish and budget." },
  { q: "How can I contact you?", a: "Call or WhatsApp 98951 34482 or 95266 10404, message us on Instagram or Facebook, or send an enquiry from this website." },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

const FurnitureShopWayanad = () => (
  <>
    <Seo
      title="Furniture Shop in Wayanad | Hitech Furniture, Kalpetta"
      description="Looking for a furniture shop in Wayanad? Hitech Furniture & Interiors, Edapetty, Kalpetta: sofas, beds, mattresses, dining sets, wardrobes and interiors for every budget."
      canonical="/furniture-shop-wayanad"
      jsonLd={[LOCAL_BUSINESS_JSONLD, FAQ_JSONLD]}
    />
    <SiteHeader />
    <main className="container-page py-12 md:py-16">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Kalpetta · Wayanad · 14+ years</p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Furniture shop in Wayanad</h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-foreground/80">
          Hitech Furniture &amp; Interiors has served homes and businesses in Kalpetta and across Wayanad for more than 14 years.
          Ready furniture, custom-made pieces, branded mattresses and complete interiors, for premium, mid-range and low budgets alike.
        </p>
        <p className="mt-3 text-base text-foreground/80">വയനാട്ടിൽ എല്ലാ ബജറ്റിനും പറ്റിയ furniture. showroom-ൽ നേരിട്ട് വന്ന് കണ്ട് തിരഞ്ഞെടുക്കാം.</p>
      </header>

      <section className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        {RANGE.map(({ title, text }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-12 max-w-3xl">
        <h2 className="font-display text-2xl">Frequently asked questions</h2>
        <div className="mt-4 space-y-4">
          {FAQS.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-4xl rounded-2xl bg-primary p-8 text-primary-foreground">
        <h2 className="font-display text-2xl">Visit our showroom in Kalpetta</h2>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <p className="flex gap-2"><MapPin className="h-5 w-5 shrink-0" /> Hitech Furniture and Interiors, Edapetty Shopping Centre, Edapetty, Kalpetta, Wayanad - 673122</p>
          <a href="tel:+919895134482" className="flex min-h-11 gap-2 hover:opacity-80"><Phone className="h-5 w-5 shrink-0" /> +91 98951 34482<br />+91 95266 10404</a>
          <p className="flex gap-2"><Clock className="h-5 w-5 shrink-0" /> Mon–Sat 9:30 AM – 8:30 PM</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="secondary" className="min-h-11"><a href="https://maps.app.goo.gl/DQWJCG1xRGEcRzx56" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></Button>
          <Button variant="secondary" className="min-h-11" onClick={() => openEnquiryForm()}>Send an enquiry</Button>
          <Button asChild variant="secondary" className="min-h-11"><Link to="/catalog">Browse catalog</Link></Button>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>
);

export default FurnitureShopWayanad;
