// Single source of truth for the in-app User Guide and About page.
// When the app gains new features, update this file and BOTH the in-app
// guide (/guide) and downloadable PDF stay in sync.

export type GuideRole =
  | "everyone"
  | "admin"
  | "office"
  | "measurement"
  | "worker"
  | "delivery"
  | "customer";

export type GuideSection = {
  id: string;
  title: string;
  audience: GuideRole[];
  intro?: string;
  steps?: string[];   // numbered list
  bullets?: string[]; // bullet list
  tip?: string;
};

export type GuideChapter = {
  id: string;
  title: string;
  audience: GuideRole[];
  sections: GuideSection[];
};

export const APP_VERSION = "1.0";
export const GUIDE_LAST_UPDATED = "2026-05-06";

export const ABOUT = {
  appName: "My Hitech",
  tagline: "Furniture & interiors operations, end to end.",
  summary:
    "My Hitech is a unified platform that runs the public catalog, customer quotations, field measurements, production jobs, deliveries and after-sales — all in one place. Each team member gets a screen tailored to their role on phone or desktop.",
  highlights: [
    "Public website with live catalog, hero animation and Google review CTA.",
    "Role-based logins for Admin, Office Staff, Measurement Staff, Workers and Delivery.",
    "5-stage Workflow Pipeline: Pricing → Quotation Sent → Production → Delivery → Delivered.",
    "Direct Order (shop stock) shortcut that skips measurement and pricing.",
    "Service & Complaint Hub for repairs, warranty issues and conversions to paid quotes.",
    "Editable home page — admins control hero text, images, visibility toggles and the review CTA.",
    "Receivables backlog with PIN-protected access window.",
    "Soft-delete + Trash so admins can restore mistakes.",
  ],
};

export const CHAPTERS: GuideChapter[] = [
  {
    id: "getting-started",
    title: "Getting started",
    audience: ["everyone"],
    sections: [
      {
        id: "logins",
        title: "Logins",
        audience: ["everyone"],
        bullets: [
          "Staff login (/auth) — Admin, Office, Measurement and Delivery use email + password.",
          "Worker login (/worker/login) — phone number + 4–6 digit PIN issued by the office.",
          "Customers do not need to sign in to browse or request a quote.",
        ],
      },
      {
        id: "roles",
        title: "Roles at a glance",
        audience: ["everyone"],
        bullets: [
          "Admin — full control of staff, products, home page, pipeline and trash.",
          "Office Staff — quotations, customers, services, receivables, dispatch.",
          "Measurement Staff — site visits, item entry, submit for pricing.",
          "Worker — view assigned production jobs, mark progress.",
          "Delivery — daily trips, route navigation, mark delivered.",
          "Customer — public website, catalog, Google review, WhatsApp chat.",
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "Admin guide",
    audience: ["admin"],
    sections: [
      {
        id: "admin-daily",
        title: "Daily flow",
        audience: ["admin"],
        steps: [
          "Open Overview to see today's quotations, pipeline counts and receivables.",
          "Open Workflow Pipeline to monitor every order across all 5 stages.",
          "Use Staff Monitor to see who is doing what right now.",
          "Re-assign or unblock work where it is stuck.",
        ],
      },
      {
        id: "admin-only",
        title: "Admin-only screens",
        audience: ["admin"],
        bullets: [
          "Home Page — edit hero images, overlay text and visibility toggles.",
          "Staff — create office, measurement and delivery accounts; reset passwords.",
          "Workers — issue worker logins (phone + PIN), view per-worker history.",
          "Products & Categories — full catalog with images and pricing.",
          "Routes — delivery route setup used by the logistics screen.",
          "Trash — restore or permanently delete soft-deleted records.",
        ],
      },
      {
        id: "direct-order",
        title: "Direct Orders (shop stock)",
        audience: ["admin", "office"],
        intro:
          "When creating a new quotation, switch on Direct Order (Shop Stock). The pipeline skips Measurement and Pricing and jumps straight to Ready for Delivery.",
      },
    ],
  },
  {
    id: "office",
    title: "Office Staff guide",
    audience: ["office"],
    sections: [
      {
        id: "office-quote",
        title: "Quotation lifecycle",
        audience: ["office"],
        steps: [
          "Open My Work → see items in Awaiting Pricing (sent by Measurement Staff).",
          "Click a quotation → fill all columns: rates, taxes, discount, terms.",
          "Click Save — status moves to Quotation Sent when finalized.",
          "Mark Assign Work once the customer accepts and advance is received.",
          "Send the quote to the customer (PDF / WhatsApp share).",
          "When delivery is complete, mark Delivery Complete — task closes.",
        ],
      },
      {
        id: "office-other",
        title: "Other duties",
        audience: ["office"],
        bullets: [
          "Create new quotations (standard or Direct Order).",
          "Manage customer Services and Complaints.",
          "Track Receivables (Backlog is PIN-locked, 15-minute window per session).",
          "Maintain customer contacts via the contact picker.",
        ],
      },
    ],
  },
  {
    id: "measurement",
    title: "Measurement Staff guide",
    audience: ["measurement"],
    sections: [
      {
        id: "field-flow",
        title: "Field task flow",
        audience: ["measurement"],
        steps: [
          "Open My Work on your phone → see assigned site visits.",
          "Open the task → enter customer details if missing.",
          "Add items one by one (product, dimensions, sketch, photos, notes).",
          "Fill all relevant fields — anything missing delays pricing.",
          "Tap Submit for Pricing. The card becomes view-only and moves to the office's Awaiting Pricing column.",
          "Your task is automatically marked Complete.",
        ],
        tip:
          "Once submitted, you cannot edit. Contact the office for any correction.",
      },
    ],
  },
  {
    id: "worker",
    title: "Worker guide",
    audience: ["worker"],
    sections: [
      {
        id: "worker-flow",
        title: "How to use",
        audience: ["worker"],
        steps: [
          "Open the worker login page on your phone.",
          "Enter your phone number and PIN given by the office.",
          "On the portal, see your assigned jobs.",
          "Tap a job to see specs, sketches and images.",
          "Update job status: Started → In Progress → Completed.",
          "When all jobs in a quotation are completed, the order moves to Ready for Delivery automatically.",
        ],
        tip:
          "Forgot your PIN? Ask the office to reset it — they can issue a new one instantly.",
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery Team guide",
    audience: ["delivery"],
    sections: [
      {
        id: "delivery-flow",
        title: "Daily trips",
        audience: ["delivery"],
        steps: [
          "Sign in → you land on My Trips.",
          "Open today's trip — see ordered stops, route map and items per customer.",
          "Use Open Route to navigate via Maps.",
          "At each stop, mark items delivered and capture proof if required.",
          "Mark Trip Completed at end of day — the orders on this trip move to Delivered (Stage 5).",
        ],
      },
    ],
  },
  {
    id: "customer",
    title: "Customer-facing website",
    audience: ["customer", "everyone"],
    sections: [
      {
        id: "site-sections",
        title: "What customers see",
        audience: ["customer", "everyone"],
        bullets: [
          "Animated hero window with admin-editable brand text and headline.",
          "Catalog of categories and products with detail pages.",
          "Google Review CTA — one-click Rate Us, Copy review link, and a hide-by-default QR code.",
          "WhatsApp floating button for instant chat.",
          "Footer with address, phones, map and About / User Guide links.",
        ],
      },
    ],
  },
  {
    id: "pipeline",
    title: "Workflow Pipeline (5 stages)",
    audience: ["everyone"],
    sections: [
      {
        id: "stages",
        title: "Stages and owners",
        audience: ["everyone"],
        bullets: [
          "Stage 1 — Waiting for Pricing · Owner: Office Staff · Trigger: Measurement Staff submits.",
          "Stage 2 — Quotation Sent · Owner: Customer · Trigger: Office finalizes.",
          "Stage 3 — Ready for Production · Owner: Workers · Trigger: Advance received / job assigned.",
          "Stage 4 — Ready for Delivery · Owner: Delivery Team · Trigger: All worker jobs done.",
          "Stage 5 — Delivered · Trigger: Delivery trip marked complete.",
        ],
        tip:
          "Green = completed, Orange = current, Grey = upcoming. Direct Orders skip Stages 1 & 2.",
      },
    ],
  },
  {
    id: "service-hub",
    title: "Service & Complaint Hub",
    audience: ["admin", "office"],
    sections: [
      {
        id: "sv-cp",
        title: "Two record types",
        audience: ["admin", "office"],
        bullets: [
          "Customer Services (SV-XXX) — repair / renovation requests at customer's home.",
          "Customer Complaints (CP-XXX) — warranty issues for items already sold.",
          "Either can be converted into a real Quotation (QT-XXX) when paid work is needed.",
          "Statuses: Pending → Scheduled → Technician Visited → Resolved / Converted / Cancelled.",
        ],
      },
    ],
  },
  {
    id: "tips",
    title: "Tips, do's & don'ts",
    audience: ["everyone"],
    sections: [
      {
        id: "do",
        title: "Do",
        audience: ["everyone"],
        bullets: [
          "Submit measurement tasks the same day — pricing waits on you.",
          "Keep customer phone numbers correct — WhatsApp share depends on it.",
          "Use the pipeline screen as your morning standup view.",
          "Reset worker PINs immediately when a worker leaves.",
        ],
      },
      {
        id: "dont",
        title: "Don't",
        audience: ["everyone"],
        bullets: [
          "Don't share staff logins between people. Each person needs their own.",
          "Don't delete records you might need later — use Trash; admins can restore.",
          "Don't mark a trip complete before all stops are actually delivered — it closes the order.",
        ],
      },
    ],
  },
];

export const filterChaptersForRole = (role: GuideRole): GuideChapter[] => {
  if (role === "everyone") return CHAPTERS;
  return CHAPTERS
    .map((ch) => {
      const sections = ch.sections.filter(
        (s) => s.audience.includes(role) || s.audience.includes("everyone"),
      );
      const audienceMatch =
        ch.audience.includes(role) || ch.audience.includes("everyone");
      if (!audienceMatch && sections.length === 0) return null;
      return { ...ch, sections };
    })
    .filter(Boolean) as GuideChapter[];
};