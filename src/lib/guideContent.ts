// Single source of truth for the in-app User Guide and About page.
// IMPORTANT: Update this file whenever any feature, screen, column,
// field or workflow changes — the in-app guide (/guide) reads from here.
// Keep CHANGELOG at the bottom in sync with every meaningful update.

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
  steps?: string[];
  bullets?: string[];
  fields?: { name: string; purpose: string }[]; // column / field reference
  tip?: string;
};

export type GuideChapter = {
  id: string;
  title: string;
  audience: GuideRole[];
  sections: GuideSection[];
};

export const APP_VERSION = "1.3";
export const GUIDE_LAST_UPDATED = "2026-05-11";

export const ABOUT = {
  appName: "My Hitech",
  tagline: "Furniture & interiors operations, end to end.",
  summary:
    "My Hitech is a unified platform that runs the public catalog, customer quotations, field measurements, production jobs, deliveries and after-sales — all in one place. Each team member gets a screen tailored to their role on phone or desktop.",
  highlights: [
    "Public website with live catalog, hero animation and Google review CTA.",
    "Role-based logins for Admin, Office Staff, Measurement Staff, Workers and Delivery.",
    "6-stage automated Workflow Pipeline: Client Hub → Dimensions → OPS → Production → Warehouse → Logistics.",
    "Client Hub Category on every new quotation (Lead / Direct Deal / Consultation / Custom Project) auto-routes the file to the right stage.",
    "Stage cards on the Overview deep-link straight into a filtered Quotations list (e.g. clicking 'Logistics' opens only Logistics-stage files).",
    "Department-specific data privacy: production never sees prices, delivery sees per-stop balance, admin/OPS can flip 'Show Price to Delivery' per quotation.",
    "Interactive in-app help — floating Help button on every admin page, role-specific manual, field tooltips and one-line action hints under primary buttons.",
    "Multi-location stock per colour variant with floor-wise display order.",
    "Direct Order (shop stock) shortcut that skips measurement and pricing.",
    "Service & Complaint Hub for repairs, warranty issues and conversions to paid quotes.",
    "Editable home page — admins control hero text, images, visibility toggles and the review CTA.",
    "Receivables backlog with PIN-protected access window.",
    "Soft-delete + Trash so admins can restore mistakes.",
  ],
};

export const CHAPTERS: GuideChapter[] = [
  // ────────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────────
  {
    id: "admin",
    title: "Admin guide",
    audience: ["admin"],
    sections: [
      {
        id: "admin-overview",
        title: "Overview screen",
        audience: ["admin"],
        intro: "First screen after admin login. Snapshot of the whole business today.",
        bullets: [
          "Today's quotations count and total value.",
          "Pipeline counts per stage (Pricing → Delivered).",
          "Receivables summary (open balance, batches).",
          "Quick links to My Work, Pipeline Monitor and Staff Monitor.",
        ],
      },
      {
        id: "admin-staff-monitor",
        title: "Staff Monitor",
        audience: ["admin"],
        intro: "Live view of who is doing what. Use it as a daily standup screen.",
        fields: [
          { name: "Staff name + role", purpose: "Identifies the user." },
          { name: "Current task", purpose: "The quotation / measurement / trip they are on." },
          { name: "Last action time", purpose: "When they last saved or moved a task." },
        ],
      },
      {
        id: "admin-pipeline",
        title: "Workflow Pipeline Monitor",
        audience: ["admin"],
        intro: "All quotations across all 5 stages in one Kanban-style view.",
        bullets: [
          "Cards are colour-coded by stage.",
          "Click a card to open the quotation editor.",
          "Drag is disabled — stages move automatically when triggers happen.",
        ],
      },
      {
        id: "admin-only-screens",
        title: "Admin-only screens",
        audience: ["admin"],
        bullets: [
          "Home Page — edit hero images, overlay text, visibility toggles.",
          "Staff — create office, measurement, delivery accounts; reset passwords.",
          "Workers — issue worker logins (phone + PIN), view per-worker history.",
          "Products & Categories — full catalog with images, pricing, variants, stock.",
          "Locations — define buildings, floors and sections used by stock.",
          "Routes — delivery routes used by the logistics screen.",
          "Trash — restore or permanently delete soft-deleted records.",
          "Receivables — full read/write; backlog area is PIN-locked.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "products",
    title: "Products & Catalog",
    audience: ["admin", "office"],
    sections: [
      {
        id: "product-fields",
        title: "Add / Edit Product — every field explained",
        audience: ["admin", "office"],
        intro: "Open Admin → Products → Add or pencil-icon to edit. Fill every field that applies.",
        fields: [
          { name: "Product name", purpose: "Public display name. Keep short and descriptive." },
          { name: "Product code", purpose: "Internal SKU. Auto-suggested; must be unique." },
          { name: "Main category / Sub category", purpose: "Where the product appears in the public catalog menu." },
          { name: "MRP", purpose: "Strike-through retail price shown to customers." },
          { name: "Offer price", purpose: "Discounted public price. Leave blank to show only MRP." },
          { name: "Cost price", purpose: "Internal cost. Never shown publicly. Used for margin reports." },
          { name: "Description", purpose: "Long copy shown on the product detail page." },
          { name: "Dimensions", purpose: "Free-text size (e.g. '6ft × 3ft × 2.5ft')." },
          { name: "Material", purpose: "Wood/fabric/finish description." },
          { name: "Reorder level", purpose: "Stock threshold for the low-stock badge." },
          { name: "Is published", purpose: "OFF hides the product from the public site." },
          { name: "Is featured", purpose: "Marks it for the home-page featured strip." },
          { name: "Images", purpose: "Multi-image gallery. First image is the main thumbnail." },
        ],
      },
      {
        id: "product-variants",
        title: "Colour variants & per-colour stock by location",
        audience: ["admin", "office"],
        intro:
          "In the Add/Edit Product screen, scroll to 'Colour variants'. Each colour can hold stock in many physical locations.",
        fields: [
          { name: "Colour name", purpose: "Display label (e.g. Walnut, Beige)." },
          { name: "Colour swatch / hex", purpose: "The dot shown to customers." },
          { name: "Variant image", purpose: "Image swapped in when a customer/staff picks this colour." },
          { name: "Floor / Location row", purpose: "Pick the building → floor → section where this colour is physically kept." },
          { name: "Qty", purpose: "Number of pieces of this colour in that location." },
          { name: "Order", purpose: "Position number on the Staff Floor View. Lower = appears first. Or use 'Arrange floor order' to drag." },
          { name: "+ Add location", purpose: "Same colour stocked in another floor/section — add a new row." },
        ],
        tip: "Public catalog still groups all colours under one parent product. Location-aware view is for staff only.",
      },
      {
        id: "staff-floor-view",
        title: "Staff Catalog (floor view)",
        audience: ["admin", "office"],
        intro: "Open from the staff menu. Browse stock the way it is laid out in the showroom.",
        bullets: [
          "Filter by Building → Floor → Section to narrow what you see.",
          "Each row shows ONLY the stock physically in the selected location — not the company-wide total.",
          "The main image automatically matches the first available colour on that floor.",
          "Zero-stock colour rows are hidden on the floor view.",
          "Use 'Arrange floor order' to reorder colours within the current Building/Floor/Section selection.",
          "Tap any row to share details on WhatsApp.",
        ],
      },
      {
        id: "categories",
        title: "Categories & Sub-categories",
        audience: ["admin"],
        bullets: [
          "Main categories (e.g. Sofas) appear in the top nav.",
          "Sub-categories (e.g. L-shape) appear in the side filter.",
          "Drag the order to reorder how customers see them.",
          "Cover image is shown on the catalog landing page.",
        ],
      },
      {
        id: "locations",
        title: "Locations (Buildings / Floors / Sections)",
        audience: ["admin"],
        intro:
          "Admin → Products → Locations dialog. Define where stock is kept so variants can be assigned to them.",
        fields: [
          { name: "Building", purpose: "Top-level place (e.g. 'Main Showroom', 'Godown')." },
          { name: "Floor", purpose: "Floor inside the building (e.g. 'Ground', 'First')." },
          { name: "Section", purpose: "Optional sub-zone (e.g. 'Window side')." },
          { name: "Active", purpose: "OFF hides the location from selectors but keeps history." },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "quotation",
    title: "Quotation — A to Z",
    audience: ["admin", "office", "measurement"],
    sections: [
      {
        id: "quotation-purpose",
        title: "What is a Quotation?",
        audience: ["admin", "office", "measurement"],
        intro:
          "A Quotation (QT-XXX) is the central business document. It carries customer info, items, prices, advance, balance and the workflow stage. Every order in the system is a quotation.",
      },
      {
        id: "quotation-header",
        title: "Header fields — every column explained",
        audience: ["office", "admin"],
        fields: [
          { name: "Quotation no.", purpose: "Auto-generated QT-XXX. Do not change." },
          { name: "Date", purpose: "Defaults to today. Used for validity and aging." },
          { name: "Expected delivery date", purpose: "Promise to customer. Drives the delivery dashboard." },
          { name: "Party name / Phone / Place / Address", purpose: "Customer details. Phone drives WhatsApp share." },
          { name: "Salesperson", purpose: "Whoever owns the deal. Pulled into reports." },
          { name: "Service type", purpose: "Standard | Direct order | Service | Complaint conversion." },
          { name: "Direct Order (Shop Stock)", purpose: "Toggle ON to skip Measurement + Pricing stages. Useful when customer buys ready stock." },
          { name: "Delivery route / place", purpose: "Used by the dispatch screen to group trips." },
        ],
      },
      {
        id: "quotation-items",
        title: "Item rows — every column explained",
        audience: ["office", "admin", "measurement"],
        fields: [
          { name: "Description", purpose: "What the item is. Free-text or pulled from catalog." },
          { name: "Measurement", purpose: "Size / dimensions captured on site." },
          { name: "Sketch", purpose: "Hand-drawn or uploaded sketch shown on the PDF." },
          { name: "Site photos", purpose: "Reference photos from the customer's home." },
          { name: "Catalog image / text", purpose: "If the item is taken from the catalog, the image and notes auto-fill." },
          { name: "Quantity", purpose: "Number of units." },
          { name: "Unit price", purpose: "Rate per unit. Office fills this during pricing." },
          { name: "Amount", purpose: "Auto = qty × unit price." },
        ],
      },
      {
        id: "quotation-totals",
        title: "Totals & terms",
        audience: ["office", "admin"],
        fields: [
          { name: "Subtotal", purpose: "Sum of all item amounts." },
          { name: "Discount", purpose: "Lump-sum discount applied before GST." },
          { name: "GST %", purpose: "Tax rate. GST amount auto-calculates." },
          { name: "Total", purpose: "Final payable. Auto-calculated." },
          { name: "Advance amount", purpose: "Money already received. Balance shows on PDF." },
          { name: "Terms", purpose: "Pre-filled standard T&C. Edit per quotation if needed." },
          { name: "Notes", purpose: "Internal notes; not printed on customer PDF." },
        ],
      },
      {
        id: "quotation-status",
        title: "Statuses & how they change",
        audience: ["office", "admin", "measurement"],
        bullets: [
          "Drafted — created but not finalized. Editable by creator.",
          "Awaiting Pricing — Measurement Staff submitted. Office must price it.",
          "Quotation Sent — finalized; PDF/WhatsApp shared with customer.",
          "Assigned to Production — advance received and workers assigned.",
          "Ready for Delivery — all worker jobs marked complete.",
          "Delivered — delivery trip marked complete.",
        ],
      },
      {
        id: "quotation-actions",
        title: "Action buttons",
        audience: ["office", "admin"],
        bullets: [
          "Save — stores changes, recalculates totals.",
          "Preview PDF — see the customer-facing document.",
          "Share on WhatsApp — opens chat with PDF link to party phone.",
          "Assign Work — pick worker(s) and items to send to production.",
          "Convert (Service/Complaint) — turns a free service ticket into a paid quotation.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "office",
    title: "Office Staff guide",
    audience: ["office"],
    sections: [
      {
        id: "office-mywork",
        title: "My Work screen",
        audience: ["office"],
        bullets: [
          "Awaiting Pricing — quotations submitted by Measurement Staff. Highest priority.",
          "Active quotations — your own in-progress work.",
          "Ready to Send — finalized; share with customer.",
          "Awaiting Delivery — done by production, hand over to delivery.",
        ],
      },
      {
        id: "office-flow",
        title: "Daily flow",
        audience: ["office"],
        steps: [
          "Open My Work → Awaiting Pricing.",
          "Open a quotation → fill rates, GST, discount, terms.",
          "Save — status moves to Quotation Sent.",
          "Share PDF on WhatsApp.",
          "When advance is received → click Assign Work, pick workers and items.",
          "When delivery is done → mark Delivery Complete.",
        ],
      },
      {
        id: "office-other",
        title: "Other office duties",
        audience: ["office"],
        bullets: [
          "Create new quotations (standard or Direct Order).",
          "Manage Services and Complaints in the Service Hub.",
          "Track Receivables (Backlog is PIN-locked, 15-minute window).",
          "Maintain customer contacts via the contact picker.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
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
          "Tap Submit for Pricing. Card becomes view-only and goes to office's Awaiting Pricing.",
          "Your task is automatically marked Complete.",
        ],
        tip: "Once submitted, you cannot edit. Contact the office for any correction.",
      },
      {
        id: "measurement-fields",
        title: "Per-item fields you must capture",
        audience: ["measurement"],
        fields: [
          { name: "Description", purpose: "Item name + customer's words." },
          { name: "Measurement", purpose: "All dimensions: width × height × depth." },
          { name: "Sketch", purpose: "Use the in-app sketch pad or upload a photo of paper sketch." },
          { name: "Site photos", purpose: "Wall, joinery, existing furniture — anything that affects pricing." },
          { name: "Quantity", purpose: "Number of units customer wants." },
          { name: "Notes", purpose: "Special requests, finishes, customer preferences." },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "worker",
    title: "Worker guide",
    audience: ["worker"],
    sections: [
      {
        id: "worker-flow",
        title: "How to use the worker portal",
        audience: ["worker"],
        steps: [
          "Open the worker login page on your phone.",
          "Enter your phone number and PIN given by the office.",
          "On the portal, see your assigned jobs.",
          "Tap a job to see specs, sketches and images.",
          "Update job status: Started → In Progress → Completed.",
          "When all jobs in a quotation are completed, the order moves to Ready for Delivery automatically.",
        ],
        tip: "Forgot your PIN? Ask the office to reset it — they can issue a new one instantly.",
      },
      {
        id: "worker-job-fields",
        title: "What each field on a job means",
        audience: ["worker"],
        fields: [
          { name: "Customer & place", purpose: "Where the item will be delivered. Helps you prioritise." },
          { name: "Items", purpose: "Specific items assigned to YOU from this order." },
          { name: "Sketch / photos", purpose: "Reference for production." },
          { name: "Urgent flag", purpose: "Office marks rush jobs in red. Do these first." },
          { name: "Status", purpose: "Your progress — keep it accurate; office sees it live." },
          { name: "Notes", purpose: "Office instructions specific to this job." },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
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
          "Mark Trip Completed at end of day — orders on this trip move to Delivered (Stage 5).",
        ],
      },
      {
        id: "delivery-fields",
        title: "Trip screen fields",
        audience: ["delivery"],
        fields: [
          { name: "Trip date", purpose: "When this delivery run happens." },
          { name: "Route", purpose: "Pre-defined route with waypoints set by admin." },
          { name: "Stops", purpose: "Customers in delivery order. Drag to reorder." },
          { name: "Delivered toggle", purpose: "Mark each customer once their items are handed over." },
          { name: "Notes", purpose: "Driver remarks for this trip." },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
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
      {
        id: "service-fields",
        title: "Service / Complaint fields",
        audience: ["admin", "office"],
        fields: [
          { name: "Customer details", purpose: "Name, phone, place, address." },
          { name: "Item description / Issue", purpose: "What needs work or what is wrong." },
          { name: "Original quotation", purpose: "Link to the original sale (for complaints under warranty)." },
          { name: "Photos", purpose: "Visual evidence; sent to the technician." },
          { name: "Estimated cost", purpose: "Rough quote before site visit." },
          { name: "Paid parts amount", purpose: "Customer-billable portion (e.g. damaged parts not under warranty)." },
          { name: "Status", purpose: "Drives the hub kanban view." },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "receivables",
    title: "Receivables & Backlog",
    audience: ["admin", "office"],
    sections: [
      {
        id: "receivables-fields",
        title: "Receivables columns",
        audience: ["admin", "office"],
        fields: [
          { name: "Bill no.", purpose: "Original invoice reference." },
          { name: "Customer / Place / Phone", purpose: "Who owes money." },
          { name: "Pending amount", purpose: "Balance still to be collected." },
          { name: "Batch", purpose: "Grouping (e.g. month) for collection drives." },
          { name: "Notes", purpose: "Last follow-up status." },
        ],
        tip:
          "Backlog area is locked behind a PIN. Once unlocked it stays open for 15 minutes per session, then re-locks automatically (also clears on sign-out).",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "pipeline",
    title: "Workflow Pipeline (6 stages)",
    audience: ["everyone"],
    sections: [
      {
        id: "stages",
        title: "Stages and owners",
        audience: ["everyone"],
        bullets: [
          "Stage 1 — Client Hub · Owner: Sales / Admin · Where new Leads, Direct Deals and Consultations land.",
          "Stage 2 — Dimensions · Owner: Measurement Team · Triggered by Custom Project category or 'Assign Dimensions'.",
          "Stage 3 — OPS · Owner: Office Staff · Triggered when measurement is submitted, advance is received, or category is Direct Deal.",
          "Stage 4 — Production · Owner: Workers · Triggered when OPS finalizes and any item is routed 'Custom'.",
          "Stage 5 — Warehouse · Owner: Warehouse Team · Ready-stock items skip Production and land here directly.",
          "Stage 6 — Logistics · Owner: Delivery Team · Triggered when items are dispatched or added to a trip.",
        ],
        tip:
          "Click any stage card on the Overview to drill into a filtered Quotations list — the heading changes to e.g. 'Logistics Queue' so you always know what you're looking at.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "settings",
    title: "Settings & Home Page (Admin)",
    audience: ["admin"],
    sections: [
      {
        id: "homepage",
        title: "Home Page editor",
        audience: ["admin"],
        fields: [
          { name: "Hero brand text / headlines", purpose: "Big text shown over the animated window." },
          { name: "Hero arch / glass / interior images", purpose: "Three layered hero images. Replace via uploader." },
          { name: "Show hero window / text toggles", purpose: "Hide either layer without deleting content." },
          { name: "Hero slides", purpose: "Auto-rotating banners under the hero." },
          { name: "Sections", purpose: "Editable content blocks (eyebrow, title, body, image, CTA)." },
          { name: "Google review / map", purpose: "Drives the Rate Us CTA and embedded map." },
          { name: "WhatsApp number / message", purpose: "Default chat target for the floating WhatsApp button." },
          { name: "Hide public prices", purpose: "Global toggle — hides MRP/offer on public site (catalog stays visible)." },
        ],
      },
      {
        id: "staff-mgmt",
        title: "Staff & Workers",
        audience: ["admin"],
        bullets: [
          "Admin → Staff: create email/password accounts and assign role.",
          "Admin → Workers: issue phone+PIN logins; reset PIN any time; revoke when worker leaves.",
          "Admin → Routes: define delivery routes used by the logistics screen.",
        ],
      },
      {
        id: "trash",
        title: "Trash",
        audience: ["admin"],
        intro: "Soft-deleted records (products, quotations, services, etc.) live here.",
        bullets: [
          "Restore — brings the record back to its original screen.",
          "Permanent delete — removes forever; not recoverable.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
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
          "Catalog of categories and products with detail pages (colours grouped under one parent).",
          "Google Review CTA — Rate Us, Copy review link, hide-by-default QR.",
          "WhatsApp floating button for instant chat.",
          "Footer with address, phones, map and About / User Guide links.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
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
          "Update stock per location whenever items are moved between floors.",
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
          "Don't enter total company stock on a single floor — split it by physical location.",
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────
  {
    id: "changelog",
    title: "What's new (changelog)",
    audience: ["everyone"],
    sections: [
      {
        id: "v1-3",
        title: "v1.3 — 2026-05-11",
        audience: ["everyone"],
        bullets: [
          "Workflow Pipeline expanded from 5 → 6 stages: Client Hub → Dimensions → OPS → Production → Warehouse → Logistics.",
          "New 'Client Hub Category' dropdown on Create Quotation (Lead, Direct Deal, Consultation, Custom Project) drives automated routing — Direct Deals jump to OPS, Custom Projects route to Dimensions.",
          "Trigger-based stage movement: measurement submission → OPS, OPS finalize → Production / Warehouse, dispatch → Logistics. No manual status updates.",
          "Overview pipeline grid + KPI cards now deep-link into a filtered Quotations list (Stage 1–6). The list heading switches to 'Client Hub Queue', 'OPS Queue', 'Logistics Queue' etc.",
          "Department-specific data privacy: production hides prices/phones; delivery sees per-stop 'Collect from Customer' amount; admin/OPS can toggle 'Show Price to Delivery Team' per quotation to expose item-wise pricing when needed.",
          "Interactive Help System rolled out — floating Help button on every admin page opens a role-specific user manual (Admin, OPS, Measurement, Worker, Delivery) with search and a tip-toggle. Field-level (?) tooltips and consequence hints under primary buttons start with the Create Quotation flow.",
          "Admin Overview gained 7/14/30-day trend sparklines for new quotations and out-for-delivery counts.",
        ],
      },
      {
        id: "v1-2",
        title: "v1.2 — 2026-05-09",
        audience: ["everyone"],
        bullets: [
          "Staff Catalog drag-to-reorder is now Admin-only — admins click 'Edit positions (admin)' and enter the admin PIN to unlock dragging.",
          "While Edit Mode is on, every card shows a small 'Drag' chip; press & hold (~0.25s) and drop into a new spot to save the new floor sequence instantly for everyone.",
          "Removed the per-card 'Move' popover — moving items now happens by drag-and-drop (admin) or via the 'Bulk arrange' dialog.",
          "Dragged cards now scale up slightly and glow with a primary outline for clearer visual feedback.",
          "Residual product cards now pick a cover image from a colour variant actually stocked on the filtered floor, so the photo on the card matches what's physically on display.",
          "Staff (non-admin) view is read-only — no accidental position changes possible.",
        ],
      },
      {
        id: "v1-1",
        title: "v1.1 — 2026-05-08",
        audience: ["everyone"],
        bullets: [
          "Multi-location stock per colour variant — same colour can be stocked on multiple floors with separate quantities.",
          "Staff Catalog now shows only stock physically present in the selected Building/Floor/Section.",
          "Main image on Staff Floor View auto-matches the first available colour on that floor.",
          "Zero-stock colour rows are hidden from the floor view.",
          "'Arrange floor order' dialog is now available at Building, Floor or Section level (not just Section).",
          "Per-colour stock rows now show small column headers: Floor / Location · Qty · Order.",
          "Comprehensive A-Z user guide with every column and field explained.",
        ],
      },
      {
        id: "v1-0",
        title: "v1.0 — 2026-05-06",
        audience: ["everyone"],
        bullets: [
          "Initial release with 5-stage workflow pipeline, Service Hub, Receivables, Worker portal, Delivery trips and editable home page.",
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
