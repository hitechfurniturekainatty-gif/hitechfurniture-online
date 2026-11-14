import { Link, useLocation } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { openEnquiryForm } from "@/lib/enquiryForm";

const pages = {
  "/sofas-kalpetta": {
    "title": "Sofas & Custom Sofa Sets in Kalpetta",
    "description": "Explore wooden, cane and upholstered sofas at Hitech Furniture in Kalpetta, Wayanad. Ask about L-shaped sofas made to your room measurements.",
    "options": [
      "Straight and corner sofa sets",
      "Wooden and cane sofas",
      "Custom seating dimensions and fabric choices"
    ],
    "prompt": "Share your room dimensions, preferred seating layout and fabric colour."
  },
  "/dining-furniture-kalpetta": {
    "title": "Dining Tables & Chairs in Kalpetta",
    "description": "Browse dining tables, upholstered chairs and 4, 6 and 8 seater dining sets at Hitech Furniture in Kalpetta, Wayanad.",
    "options": [
      "4, 6 and 8 seater dining sets",
      "Wooden dining tables",
      "Dining chairs and crockery units"
    ],
    "prompt": "Share the number of seats you need and your available dining space."
  },
  "/office-furniture-kalpetta": {
    "title": "Office Furniture in Kalpetta",
    "description": "Find office desks, ergonomic chairs, visitor seating and meeting tables at Hitech Furniture in Kalpetta, Wayanad.",
    "options": [
      "Office desks and workstations",
      "Ergonomic chairs and visitor seating",
      "Meeting tables and office storage"
    ],
    "prompt": "Share your floor plan or desk dimensions and the number of people to seat."
  },
  "/modular-kitchens-wayanad": {
    "title": "Modular Kitchens in Wayanad",
    "description": "Plan kitchen cabinets, pantry storage and appliance spaces with Hitech Furniture & Interiors in Kalpetta, Wayanad.",
    "options": [
      "Base and wall cabinets",
      "Pantry and appliance storage",
      "Cabinet finishes and layout planning"
    ],
    "prompt": "Share your kitchen dimensions, door and window positions, and appliances."
  },
  "/home-interiors-wayanad": {
    "title": "Home Interiors in Wayanad",
    "description": "Discuss living room, bedroom and kitchen interiors with Hitech Furniture & Interiors in Kalpetta, Wayanad.",
    "options": [
      "Living room partitions and TV units",
      "Bedroom wardrobes and dressing units",
      "Kitchen cabinetry and coordinated finishes"
    ],
    "prompt": "Share your floor plan, room photos and which rooms you want to furnish."
  }
};

type PagePath = keyof typeof pages;

export default function FurnitureCategoryLanding() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, "") as PagePath;
  const { title, description, options, prompt } = pages[path];

  return (
    <>
      <Seo title={`${title} | Hitech Furniture`} description={description} canonical={path} />
      <SiteHeader />
      <main className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-4">
            <h1 className="font-display text-4xl font-bold md:text-5xl">{title}</h1>
            <p className="text-lg text-muted-foreground">{description}</p>
          </div>
          <section className="rounded-xl border bg-card p-6">
            <h2 className="font-display text-2xl font-semibold">Options to discuss</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              {options.map((option) => <li key={option}>{option}</li>)}
            </ul>
          </section>
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-semibold">Ask for a quote</h2>
            <p>{prompt}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => openEnquiryForm()}>Send an enquiry</Button>
              <Button asChild variant="outline"><Link to="/catalog">Browse the catalogue</Link></Button>
            </div>
          </section>
          <nav aria-label="Furniture and interiors" className="flex flex-wrap gap-4">
            <Link className="underline" to="/furniture-shop-wayanad">Showroom directions</Link>
            {Object.entries(pages).filter(([url]) => url !== path).map(([url, page]) => (
              <Link className="underline" key={url} to={url}>{page.title}</Link>
            ))}
          </nav>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
