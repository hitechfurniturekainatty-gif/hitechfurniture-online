import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Seo } from "@/components/Seo";
import { LOCAL_BUSINESS_JSONLD } from "@/lib/localBusinessSchema";
import { openEnquiryForm } from "@/lib/enquiryForm";
import { MapPin, Phone, Clock, Truck, Hammer, BedDouble, Sofa, BookOpen } from "lucide-react";

const POINTS = [
  { icon: Hammer, title: "Custom furniture", text: "Sofas, cots, wardrobes and dining sets made to your size, finish and budget." },
  { icon: Sofa, title: "Complete interiors", text: "Living, bedroom and kitchen interiors — from planning to installation." },
  { icon: BedDouble, title: "Branded mattresses", text: "Kurlon, Repose, Peps, Modo and good local makes — for every budget." },
  { icon: Truck, title: "Delivery", text: "Across Wayanad and Malabar, plus Bengaluru and Tamil Nadu on request." },
];

const About = () => (
  <>
    <Seo
      title="About Hitech Furniture & Interiors — Kalpetta, Wayanad"
      description="Hitech Furniture & Interiors, Edapetty, Kalpetta: 14+ years of custom furniture, complete interiors and branded mattresses for every budget in Wayanad."
      jsonLd={LOCAL_BUSINESS_JSONLD}
    />
    <SiteHeader />
    <main className="container-page py-12 md:py-16">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">About Hitech · 14+ years</p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Hitech Furniture &amp; Interiors</h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-foreground/80">
          For over 14 years we have furnished homes and businesses across Wayanad — custom furniture, ready collections,
          complete interiors and branded mattresses. Premium or low budget, every customer is welcome.
        </p>
        <p className="mt-3 text-base text-foreground/80">എല്ലാ ബജറ്റിനും പറ്റിയ furniture — showroom-ൽ നേരിട്ട് വന്ന് കാണാം.</p>
      </header>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
            <Icon className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-display text-xl">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <section className="mx-auto mt-10 max-w-4xl rounded-2xl bg-primary p-8 text-primary-foreground">
        <h2 className="font-display text-2xl">Visit our showroom</h2>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <p className="flex gap-2"><MapPin className="h-5 w-5 shrink-0" /> Edapetty Shopping Centre, Edapetty, Kalpetta, Wayanad - 673122</p>
          <a href="tel:+919895134482" className="flex min-h-11 gap-2 hover:opacity-80"><Phone className="h-5 w-5 shrink-0" /> +91 98951 34482<br />+91 95266 10404</a>
          <p className="flex gap-2"><Clock className="h-5 w-5 shrink-0" /> Mon–Sat 9:30 AM – 8:30 PM</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="secondary" className="min-h-11"><a href="https://maps.app.goo.gl/DQWJCG1xRGEcRzx56" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></Button>
          <Button variant="secondary" className="min-h-11" onClick={() => openEnquiryForm()}>Send an enquiry</Button>
          <Button asChild variant="secondary" className="min-h-11"><Link to="/catalog">Browse catalog</Link></Button>
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Staff? <Link to="/guide" className="inline-flex items-center gap-1 underline"><BookOpen className="h-3 w-3" /> User Guide</Link>
      </p>
    </main>
    <SiteFooter />
  </>
);

export default About;
