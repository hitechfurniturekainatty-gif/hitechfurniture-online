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

export const APP_VERSION = "2.5";
export const GUIDE_LAST_UPDATED = "2026-11-21";

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
        title: "Home dashboard (Overview)",
        audience: ["admin"],
        intro: "First screen after login (menu: Overview). Shows what needs doing today and how the business is running, and every number opens the page where you can act on it.",
        bullets: [
          "Top: greeting with today's date and how many things are due today / overdue. Buttons + Enquiry, + Quotation, + Task and + Complaint open a new one straight away.",
          "Six tiles — tap any tile to open that page: Open enquiries (new today), Quotations to follow (total ₹ in play), Orders this month (₹ confirmed, with ▲/▼ % against last month), Payments pending (follow-ups overdue in red), Deliveries in the next 7 days (past-due in red), Out of stock (items at or below reorder level).",
          "My work — one list of everything to act on, in three tabs: Overdue, Today, Next 7 days. It mixes enquiry calls, quotation follow-ups, payment collection, your own tasks (My Diary) and delivery payments waiting to be verified. Tap a row to open it. When nothing is due today but older work is waiting, it opens on Overdue.",
          "Order pipeline — how many orders sit at each of the 6 stages (Enquiry → Measurement → Order (OPS) → Production → Warehouse → Delivery) with their ₹ value. Below it: open complaints and out-of-stock alerts.",
          "Biggest quotations to close — the largest quotations still in follow-up, with the follow-up date (red when it has passed).",
          "Recently added — the newest enquiries and quotations.",
          "Colours: each box has a coloured top bar (green My work, navy pipeline, orange quotations, teal recent) so you can find it quickly. Red text always means overdue or needs attention.",
        ],
        tip: "To clear the Overdue tab: open each row and either set a new follow-up date, mark it done, or mark the enquiry / quotation lost. Deliveries shown as past-due are often already delivered but not marked — update them in Delivery so the numbers stay correct.",
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
        id: "office-home",
        title: "Home dashboard (Overview)",
        audience: ["office"],
        intro: "First screen after login. Start the day here: clear the Overdue tab, then Today.",
        bullets: [
          "Top: greeting with today's date and how many things are due today / overdue. Buttons + Enquiry, + Quotation, + Task and + Complaint open a new one straight away.",
          "Six tiles — tap any tile to open that page: Open enquiries (new today), Quotations to follow (total ₹ in play), Orders this month (₹ confirmed, with ▲/▼ % against last month), Payments pending (follow-ups overdue in red), Deliveries in the next 7 days (past-due in red), Out of stock (items at or below reorder level).",
          "My work — one list of everything to act on, in three tabs: Overdue, Today, Next 7 days. It mixes enquiry calls, quotation follow-ups, payment collection, your own tasks (My Diary) and delivery payments waiting to be verified. Tap a row to open it. When nothing is due today but older work is waiting, it opens on Overdue.",
          "Order pipeline — how many orders sit at each of the 6 stages (Enquiry → Measurement → Order (OPS) → Production → Warehouse → Delivery) with their ₹ value. Below it: open complaints and out-of-stock alerts.",
          "Biggest quotations to close — the largest quotations still in follow-up, with the follow-up date (red when it has passed).",
          "Recently added — the newest enquiries and quotations.",
          "Colours: each box has a coloured top bar (green My work, navy pipeline, orange quotations, teal recent) so you can find it quickly. Red text always means overdue or needs attention.",
        ],
        tip: "To clear the Overdue tab: open each row and either set a new follow-up date, mark it done, or mark the enquiry / quotation lost. Deliveries shown as past-due are often already delivered but not marked — update them in Delivery so the numbers stay correct.",
      },
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
          "Start in Operations → 1 · Leads & Follow-up. Website enquiries and new WhatsApp chats arrive here automatically; walk-ins and phone calls are added with + Add manual lead.",
          "Assign a salesman and a next call time. A lead not contacted within 4 hours raises a bell alert.",
          "After every call open the lead → tap the result (Call എടുത്തില്ല / Busy / താല്പര്യമുണ്ട് / Showroom visit / Quotation ചോദിച്ചു / വേണ്ട), write what was said and pick the next call date (ഇന്ന് / നാളെ / 3 ദിവസം / 1 ആഴ്ച). Every call is kept in Follow-up history; old notes are never overwritten.",
          "When the next call time arrives the bell shows \"Follow-up due · salesman name\". If it is still not done 24 hours later, admins get \"Follow-up overdue 24h\". Use \"എന്റെ ഇന്നത്തെ follow-ups\" to see only your own due calls.",
          "When the customer wants a price → Convert to quotation. Older leads saved as quotations are listed at the bottom of the Leads page (\"പഴയ ലീഡുകൾ\").",
          "Open the quotation → fill items, rates, GST, discount, terms. Set Ready stock / Custom for every item.",
          "Share the live quotation link on WhatsApp. This marks it Quote Sent and schedules a follow-up call 2 days later (10:30 AM).",
          "The customer can tap Approve on the link — staff get a bell alert and a green banner on the quotation. Collect the advance, then press Confirm Order.",
          "Custom items of confirmed orders appear on 4 · Production Board under \"വർക്കറെ ഏൽപ്പിക്കാൻ ബാക്കി\" until a worker job is assigned.",
          "Ready items → 5 · Warehouse → 6 · Delivery. After delivery the balance becomes a receivable automatically.",
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
      {
        id: "supplier-orders",
        title: "Supplier Orders: custom items and stock purchases",
        audience: ["admin", "office"],
        intro: "Every custom piece we get made by a supplier, and every stock purchase, is written here with the date the supplier promised. Nothing is forgotten and nothing is bought twice.",
        steps: [
          "Open Operations → Supplier Orders. The 'Not ordered yet' tab lists custom items on confirmed orders that nobody has ordered.",
          "When you order an item, press 'Ordered from…', type the supplier, the order date and the date the supplier promised (+7 / +15 / +30 buttons help), and Save.",
          "The item moves to 'Waiting'. Late ones turn red with the number of days late.",
          "When the piece arrives, press Received, then plan the customer's delivery. If the supplier gives a new date, pick it and press New date. A wrong entry: Cancel.",
          "For a stock purchase (no customer), use New supplier order, or the Order button on Inventory → Reorder Report.",
        ],
        bullets: [
          "Every morning at 10 AM the office gets an alert for each late supplier order (repeats every 2 days while late) and one alert listing confirmed custom items not yet ordered.",
          "On a confirmed order with custom items, the order page shows a Supplier orders button for just that order.",
        ],
      },
      {
        id: "ob-quotations",
        title: "Quotations made in Output Books",
        audience: ["admin", "office"],
        intro: "Quotations can be typed in Output Books (QTE…), where each line picks a product with its photo. Every 5 minutes they appear on the website under Quotations & Orders, with the same customer, items, rates and photos.",
        steps: [
          "Make or edit the quotation in Output Books (customer, items, quantity, rate, discount).",
          "Within 5 minutes it appears in Operations → 3 · Quotations & Orders, marked \"Output Books QTE… · edit items there\".",
          "Made-to-order (custom) piece: in Output Books pick the item \"CUSTOM – Sofa\" (or Wardrobe, Dining, Bed, Kitchen, Other) and write the size, material and colour in the description. Never pick a real model as a stand-in.",
          "For a custom item, open the quotation on the website, mark the item Custom and add the sketch, measurement or site photo.",
          "Follow-up, share link, advance, Confirm Order, supplier orders, delivery and payment are all done on the website.",
        ],
        bullets: [
          "Items, quantity and rate: change them only in Output Books. A change made on the website is replaced at the next sync.",
          "Photos, sketch, measurement, notes, Ready stock / Custom, advance, delivery date and follow-ups are website-only; the sync never changes them.",
          "A line deleted in Output Books disappears on the website; if staff had added a photo to it, it stays at ₹0 marked \"[Removed in Output Books]\".",
          "After Confirm Order on the website, the sync stops for that quotation.",
          "Every Output Books quotation becomes an OPEN lead in 1 · Leads & Follow-up (stage Quotation, next call in 2 days, item list and photo shown). If the same phone already has an open lead (for example from Instagram), that lead is used. Follow up there like any lead. Always enter the customer's phone in Output Books.",
          "Customer agrees → open the lead → Open quotation → add advance → Confirm Order. The lead turns Converted by itself.",
          "Customer says no → mark the lead Lost with a reason. Its draft quotation is rejected by itself.",
          "Quotations & Orders has a source filter: 🏬 Shop / Output Books or 🌐 Online enquiries (website, WhatsApp, Instagram, Facebook, Google).",
        ],
      },
      {
        id: "custom-items-photos",
        title: "CUSTOM items and which photo shows where",
        audience: ["admin", "office", "measurement"],
        intro: "A photo from Output Books shows a model we stock. For a made-to-order piece that photo is NOT what the customer will get, so the website shows it only as a labelled reference.",
        steps: [
          "Output Books has six quotation-only items: CUSTOM – Sofa, CUSTOM – Wardrobe, CUSTOM – Dining, CUSTOM – Bed, CUSTOM – Kitchen, CUSTOM – Other (type Service / Non-inventory, no stock, no photo).",
          "Use one of them for every made-to-order piece. Write size, material, colour and design in the line description.",
          "On the website, mark that line Custom and add the sketch, measurement and site photos.",
        ],
        bullets: [
          "Items whose name starts with \"CUSTOM\" never appear in the website catalog.",
          "Ready-stock item with no staff photo: the Output Books photo is shown in the Image column (it is the real product).",
          "Staff photo or sketch added: the staff photo goes in the Image column; the Output Books photo is shown small, labelled \"Reference only – not final model\".",
          "Custom item: the Output Books photo is never shown as the product. The quotation shows it only as \"Reference only – not final model\"; the delivery note, worker job, warehouse and supplier order do not show it at all.",
          "No photo is deleted or changed — only where it is shown.",
        ],
        tip: "If a customer likes a stock model but wants changes (size, colour), make it a CUSTOM line and write the changes. Do not sell it under the stock model's name.",
      },
      {
        id: "cleanup",
        title: "Clean-up: clear old records",
        audience: ["admin", "office"],
        intro: "One page for the three old piles: draft quotations older than 30 days, open leads with no next call, and confirmed orders past their delivery date. Nothing is deleted.",
        steps: [
          "Open Operations → Clean-up.",
          "Old quotations: tick the ones the customer will not buy and press Lost ആക്കുക. Open any that still has a chance and follow up.",
          "Leads without next call: tick and choose നാളെ വിളിക്കുക / 3 ദിവസം / 1 ആഴ്ച, or pick a reason and press Lost ആക്കുക.",
          "Orders past date: if it was delivered press Mark delivered; if not, pick a new date and press New date.",
        ],
        tip: "Do this once a week. When the lists are empty, My work and the bell show only real work.",
      },
      {
        id: "rate-card",
        title: "Rate Card & price estimate",
        audience: ["admin", "office", "measurement"],
        intro: "Give a customer an approximate price for a custom piece on the spot, from the rates our suppliers charge.",
        steps: [
          "Open Finance → Rate Card & Estimate.",
          "Tap the item type (e.g. Wardrobe) and, if shown, the material.",
          "Enter width and height in feet (or length for running-foot items, or how many for per-piece items).",
          "The approximate price shows as a range across suppliers. 'Copy for customer' copies a ready WhatsApp message.",
        ],
        bullets: [
          "Admins add and edit rates at the bottom of the page: supplier, item type, material, unit (sq ft, running ft, piece, seat, set), cost rate, selling rate, days to make.",
          "Only admins see cost rates and margin. Staff see selling rates only.",
          "The estimate is approximate. The final price is given after measurement and design.",
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
        id: "mark-delivered",
        title: "Mark an order Delivered (with or without a trip)",
        audience: ["admin", "office", "delivery"],
        intro: "The last step of every order. Until it is done the order stays in the overdue lists and no payment balance is created.",
        steps: [
          "Open Operations → 6 · Delivery (or the order itself). Confirmed orders show a green Mark delivered / Delivered button — also on each row of Overdue deliveries.",
          "Tick the items that reached the customer (all are ticked). Untick anything still to go — the order becomes Part delivered and stays on the list for the rest.",
          "Pick the date (today by default; past dates allowed for old deliveries) and who delivered.",
          "Payment at delivery (optional): choose Cash / UPI / Cheque / Card and the amount, or 'Payment കിട്ടിയില്ല' with the date the customer promised.",
          "Press Mark order delivered.",
        ],
        bullets: [
          "The order shows ✓ Delivered with the date, moves to stage 6, and leaves the overdue lists.",
          "The office gets an 'Order delivered' alert and a 'Request Google review' reminder.",
          "The remaining balance appears in Payments automatically (Payment pending), or the order closes when fully paid.",
          "A payment entered here waits in Operations → Delivery Collections until the office counts the cash / checks the UPI and presses Verify.",
          "Trips (My Trips) still work the same way; use whichever is easier.",
        ],
        tip: "Old orders that were already delivered but never marked: open each one from Overdue deliveries, set the real delivery date and press Mark order delivered.",
      },
      {
        id: "delivery-flow",
        title: "Daily trips",
        audience: ["delivery"],
        steps: [
          "Sign in → you land on My Trips.",
          "Open today's trip — see ordered stops, route map and items per customer.",
          "Use Open Route to navigate via Maps.",
          "At each stop, mark items delivered and capture proof if required.",
          "At each stop record what was delivered — the order moves to ✓ Delivered when its last item is delivered.",
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
      {
        id: "receivables-busy-refresh",
        title: "Refresh balances from Busy Excel",
        audience: ["admin"],
        bullets: [
          "Backlog → Manual / Busy Receivables Ledger → “Refresh balances from Busy Excel”. Choose the Busy debtors Excel file (columns Account and Balance; Sales Man and Mobile No. are used when present).",
          "The screen shows a preview first: customers with balance, total balance, new / updated / closed counts, customers without a mobile number or salesman. Nothing changes until you press Apply.",
          "Balances are replaced with the file. Customers are never deleted, so call notes, promise dates, follow-ups and payments stay. A customer at zero balance, or no longer in the file, is closed; if the balance comes back in a later file the customer reopens.",
          "The mobile number is taken from the last 10 digits of the Busy account name when the Mobile No. column is empty.",
          "Customers added by this refresh do not get the automatic 1/3/7/15-day reminders (they would flood the follow-up list). Set a promise date on a customer to get a reminder.",
          "Upload a fresh file every morning. If the red warning says many open customers are missing, check you chose the full debtors list.",
          "“Clear Manual” and delete remove the customer together with call notes, promise dates and payments. Use the refresh instead to update balances.",
        ],
        tip: "Only Admin users can see or upload receivables.",
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
        id: "v2-5",
        title: "v2.5 — 2026-11-25",
        audience: ["everyone"],
        bullets: [
          "Output Books \"CUSTOM – …\" items (Sofa, Wardrobe, Dining, Bed, Kitchen, Other) are for made-to-order quotations only and never show in the website catalog.",
          "Quotation photos: a ready-stock item with only the Output Books photo now shows it in the Image column. When a staff photo or sketch exists, or the item is Custom, the Output Books photo is shown small as \"Reference only – not final model\".",
          "Custom items: the reference photo is no longer shown on the delivery note, worker job (app, link and PDF), warehouse or supplier orders.",
        ],
      },
      {
        id: "v2-4",
        title: "v2.4 — 2026-11-24",
        audience: ["everyone"],
        bullets: [
          "Bell alerts cleaned up: 2,634 old alerts were marked read, and every night alerts older than 7 days are marked read automatically. The bell now shows only recent, useful alerts.",
          "\"Quotation expiring soon\" is now sent once per quotation (15–60 days old), not every week for ever. \"Balance payment due\" is sent from 3 days before to 7 days after the delivery date, at most once a week; older balances are followed up in Payments.",
          "AI features (Snap Search, bulk extract, AI image) now use Hitech's own Google Gemini key instead of Lovable.",
          "Quotations made in Output Books now appear on the website every 5 minutes with the same customer, items, rates and product photos. Edit items in Output Books; photos, follow-up, confirm, delivery and payment stay on the website.",
          "Each Output Books quotation now lands in Leads & Follow-up as an open lead (stage Quotation, call in 2 days). Confirm Order turns the lead Converted; marking the lead Lost rejects its draft quotation.",
          "New Operations → Clean-up: clear old draft quotations (Lost), leads with no next call (set a date or Lost with reason) and confirmed orders past their delivery date (Mark delivered or new date) in bulk.",
        ],
      },
      {
        id: "v2-3",
        title: "v2.3 — 2026-11-24",
        audience: ["everyone"],
        bullets: [
          "New Operations → Supplier Orders: record who each custom item was ordered from and the promised date. 'Not ordered yet' lists confirmed custom items nobody ordered. Late orders turn red, and the office gets a 10 AM alert.",
          "New Finance → Rate Card & Estimate: approximate price for custom furniture from supplier rates (sq ft, running ft, piece). Staff see selling rates; admins manage rates and see cost and margin.",
          "Reorder Report now shows what sold in the last 90 days and what is already on order from a supplier, so stock is not bought twice. Each row has an Order button.",
          "Confirmed orders with custom items show a Supplier orders button on the order page.",
        ],
      },
      {
        id: "v2-2",
        title: "v2.2 — 2026-11-21",
        audience: ["everyone"],
        bullets: [
          "New Mark delivered button on the Delivery page (day list and Overdue deliveries) and on every confirmed order, for admin, office and delivery staff — no trip needed. Tick the items, date, who delivered and any payment collected. The order becomes ✓ Delivered, the balance goes to Payments, and the office gets the delivered + Google review alerts.",
          "Part deliveries: untick items not yet sent; the order stays on the list until the rest is delivered.",
          "Home dashboard pipeline shows ✓ Delivered this month (tap it for the list).",
          "Delivery history: Quotations & Orders → filter '✓ Delivered (history)'. Fully paid parties: filter 'Closed — fully paid'. Manual / Busy bills that are settled: Backlog & Receivables → Closed tab.",
          "Orders marked delivered earlier now all sit at stage 6.",
          "Menu tidied: 4 · Production Board, Work Progress Reports, Stock Ledger, Inbound Receiving, Stock-take and Transfers are hidden (little use; stock comes from Output Books). Nothing was deleted — admin can bring them back.",
        ],
      },
      {
        id: "v2-1",
        title: "v2.1 — 2026-11-21",
        audience: ["everyone"],
        bullets: [
          "New home dashboard after login (Overview): greeting with quick-add buttons (Enquiry, Quotation, Task, Complaint), six clickable tiles, a My work list (Overdue / Today / Next 7 days), the 6-stage order pipeline with ₹ value, biggest quotations to close and recently added. See Admin guide / Office Staff guide → Home dashboard.",
          "Dashboard boxes now have coloured headings and top bars; the rest of the site keeps the Hitech brown theme.",
          "Backups: website data, Output Books data and photos, and n8n automations are now copied every day to Hostinger and Google Drive, and a monthly test proves the website backup can be restored.",
        ],
      },
      {
        id: "v2-0",
        title: "v2.0 — 2026-11-20",
        audience: ["everyone"],
        bullets: [
          "Delivery payment: in My Trips each stop has a Payment button. The driver records the amount and how it was paid (Cash / UPI / Cheque / Card), the UPI or cheque reference, or 'കിട്ടിയില്ല' with the date the customer promised. If less than the balance is paid, the promise date for the rest is required.",
          "Nothing changes the customer's balance until the office verifies it. New page Operations → Delivery Collections shows each driver's total waiting to be handed over (by Cash / UPI). Count the cash or check the UPI, then press Verify: the payment is added to the order's balance like any other payment, and the promise date goes onto the payment follow-up. Reject needs a reason.",
          "Every entry also raises an alert ('Payment collected' / 'Payment NOT collected').",
          "Rule: drivers hand over cash to the office the same day.",
          "Ready-stock check: when an order is confirmed, ready-stock items are compared with free stock (Output Books stock minus what other open orders already hold). If it is short, a warning lists the items and asks before confirming, so the same piece is not sold twice.",
          "Evening Delivery Pack (n8n, 7:30 PM): tomorrow's deliveries by trip/driver, items ready or not, balance and delivery-slip links. For it to be complete, put the Delivery date on every confirmed order and assign tomorrow's trip before 5 PM.",
        ],
      },
      {
        id: "v1-9",
        title: "v1.9 — 2026-11-20",
        audience: ["everyone"],
        bullets: [
          "New Sales Board (Operations → Sales Board, or the Sales Board button on the Leads page): every lead is a card in a column — New, Contacted, Showroom visit, Quotation, Order, Lost. Drag a card to the next column.",
          "Moving to Contacted or Showroom visit asks for the next call date and an optional note, and saves it in the lead's Follow-up history. Moving to Lost asks for the reason. Moving to Quotation creates the quotation.",
          "Order fills itself when the quotation is confirmed. Quotation and Order cards cannot be dragged. Cards show Overdue (red) and ഇന്ന് (today) tags; today's calls are at the top of each column. Use \"എന്റെ leads\" to see only your own.",
          "On a phone, press and hold a card for a moment, then drag.",
        ],
      },
      {
        id: "v1-8",
        title: "v1.8 — 2026-11-20",
        audience: ["everyone"],
        bullets: [
          "Leads: when a lead is marked Lost or Cancelled, a reason must be chosen (price, bought elsewhere, no response, later, product not suitable, delivery time, duplicate, other). The reason shows as a red tag on the lead card.",
          "Leads: new \"Source report\" (open it above the list) shows, for the chosen month, how many leads came from each source, how many became quotations, how many were lost, the conversion %, and the lost reasons.",
          "New Customer history page (Operations → Customer history, or the History button on a lead): type a phone number to see that customer's leads, quotations and orders, payments due, complaints and service in one place.",
          "Security: leads can now be seen and changed only by office staff and admins. Delivery, measurement and other logins no longer have access to the lead list.",
        ],
      },
      {
        id: "v1-7",
        title: "v1.7 — 2026-11-20",
        audience: ["everyone"],
        bullets: [
          "Leads: every call or note is now saved as a separate entry in Follow-up history (who, when, result, next date). Before, the single notes box was overwritten each time. Existing notes were copied in as the first entry.",
          "Leads: log a call with one tap on the result plus quick next-date buttons. An open lead must always have a next call date, unless the customer said no.",
          "Bell reminder when a lead's next follow-up time arrives (checked every 15 minutes), named with the salesman. Admins are alerted if it is still not done after 24 hours.",
          "Leads page: new \"എന്റെ ഇന്നത്തെ follow-ups\" button shows only your own due and overdue calls.",
        ],
      },
      {
        id: "v1-6",
        title: "v1.6 — 2026-11-18",
        audience: ["everyone"],
        bullets: [
          "Receivables: new “Refresh balances from Busy Excel” upload. It replaces balances from the file and keeps call notes, promise dates and payments (nothing is deleted).",
          "Receivables lists now load every customer (before, only the first 1000 were read) and the follow-up list has a search box and shows 100 at a time.",
          "Clear / delete warnings on Manual receivables now say that call notes, promise dates and payments are removed too.",
        ],
      },
      {
        id: "v1-5",
        title: "v1.5 — 2026-11-14",
        audience: ["everyone"],
        bullets: [
          "Website product page (mobile): a bar with WhatsApp and Enquire buttons now stays at the bottom of the screen while the customer scrolls.",
          "WhatsApp from a product page opens with the product name, code and link already typed, so staff can see which item the customer means. On a catalog category the message names that category.",
          "Product cards in the catalog now show a clear \"Enquire\" button instead of a small unlabelled icon.",
          "Website enquiry form is now 2 steps instead of 3: tapping the enquiry type moves straight to the details, and \"Send enquiry\" submits directly (the separate review screen is removed).",
          "Photo gate: an order cannot be confirmed while a ready-stock item has no photo (item photo, catalog photo or sketch all count). The message names the item numbers. Take the photo on the phone, save, then confirm. Items marked Custom are not blocked, because the piece does not exist yet — add its photo when it reaches the shop.",
          "New leads are given to salesmen in turn (Ayoob AM, Thahir KK, Abdul Raheem). A customer who enquires again with the same phone number goes back to the same salesman. Leads staff add by hand stay with the person who added them.",
          "Custom work for outside suppliers (creditors): in a confirmed order choose Assign job → Supplier · Direct WhatsApp Share, type the supplier's name (suggestions come from the Busy creditor list; a new name is saved automatically) and set the Ready date. The job is now always recorded and shows on the Production Board, even though the file is shared from your own phone. Earlier, direct shares were not recorded at all.",
          "Production Board: when the item reaches the shop, staff change the card's status to \"Completed · ഷോപ്പിൽ എത്തി\". The supplier does not need a login. Jobs past their Ready date show as Overdue.",
          "Instagram / Facebook leads: when the customer types a mobile number in the chat, it is now copied into the lead's Phone automatically so staff can call or WhatsApp.",
          "Enquiry form: field names are shown in Malayalam too, and a mistake (missing name, wrong phone number) is shown in red right under that field instead of a pop-up at the top.",
          "Leads from the website form now record how the customer reached the site: Meta ad, Google ad or Organic, plus the campaign name when the ad link has one. It shows as a grey tag on the lead card and in Ad source inside the lead. An ad click is remembered for 30 days on the customer's phone. Leads that come directly on WhatsApp or by phone still need Ad source set by staff.",
          "Catalog: when a collection is showroom-only, the page says \"ഈ collection showroom-ൽ നേരിട്ട് കാണാം\" with an Ask for photos button instead of \"0 pieces found\".",
          "After sending an enquiry the customer sees Continue on WhatsApp, Call us and Showroom map buttons with showroom hours. A WhatsApp message starting \"I just sent an enquiry on your website (Ref LD-…)\" is the same customer as that lead — reply there, do not create a second lead.",
        ],
      },
      {
        id: "v1-4",
        title: "v1.4 — 2026-10-11",
        audience: ["everyone"],
        bullets: [
          "Fixed: website enquiry form had stopped saving new leads since 28-Sep (duplicate lead code). Lead codes now run LD-2026-0001, 0002…",
          "AI (Claude, via n8n every 10 min) reads each WhatsApp lead's chat and fills name, place, requirement, enquiry type and budget. Names/places typed by staff are never overwritten; chats that look like suppliers or spam get a note \"AI: may not be a sales enquiry\".",
          "WhatsApp chats from new numbers become leads automatically (source: WhatsApp). Staff, workers and existing customers are skipped. WhatsApp Inbox has a \"Lead ആക്കുക\" button.",
          "Leads page: WhatsApp button on every lead, and a \"പഴയ ലീഡുകൾ\" section listing older leads that were saved as quotations.",
          "Bell alert when a new lead is not contacted within 4 hours.",
          "Sharing a quotation link marks it Quote Sent and auto-schedules a follow-up call 2 days later.",
          "Customers can Approve a quotation from the shared link; staff are alerted and the quotation shows a green approval banner.",
          "Production Board lists confirmed custom items that have not been assigned to any worker.",
          "Side menu reordered to follow the pipeline: Leads → Measurement → Quotations & Orders → Production → Warehouse → Delivery.",
        ],
      },
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
