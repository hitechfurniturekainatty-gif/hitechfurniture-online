// Single source of truth for in-app help copy.
// Update strings here — no DB, no rebuild logic, no translations (yet).

import type { AppRole } from "@/hooks/useAuth";

export type FieldHelp = { title: string; example?: string };

export const FIELD_HELP: Record<string, FieldHelp> = {
  // Quotation create / editor
  "quotation.lead_type": {
    title: "How did this enquiry come in? Drives where the file lands automatically.",
    example: "Lead = walk-in/phone enquiry · Direct Deal = ready stock sale · Custom Project = needs site measurement",
  },
  "quotation.party_name": { title: "Customer's full name as it should appear on the quotation.", example: "Mr. Rajesh Menon" },
  "quotation.party_phone": { title: "Primary mobile number with country code. Used for WhatsApp share.", example: "+91 95266 10404" },
  "quotation.party_place": { title: "City or area — used for delivery routing.", example: "Kakkanad" },
  "quotation.party_address": { title: "Full delivery address. Optional at creation, required before dispatch." },
  "quotation.advance_amount": {
    title: "Advance received from customer. Setting this moves the file to OPS automatically.",
    example: "25000 (₹25,000 advance)",
  },
  "quotation.gst_percent": { title: "GST rate to apply on the subtotal.", example: "18 for furniture" },
  "quotation.discount_amount": { title: "Flat discount in rupees, deducted before GST.", example: "500" },
  "quotation.expected_delivery_date": { title: "Promised delivery date shown to the customer." },
  "quotation.delivery_route": { title: "Pre-defined delivery route. Helps the logistics team batch trips." },
  "quotation.salesperson_name": { title: "Who sold this? Used in the staff sales monitor." },
  "quotation.notes": { title: "Internal notes — never shown to the customer." },
  "quotation.terms": { title: "Terms & conditions printed on the PDF. Default is editable per quotation." },

  // Quotation item
  "item.description": { title: "What is this line item? Be specific.", example: "5-door wardrobe with mirror, oak finish" },
  "item.measurement": { title: "Site measurements in the format the workshop expects.", example: "W 1800 × H 2100 × D 600 mm" },
  "item.quantity": { title: "How many of this item.", example: "1" },
  "item.unit_price": { title: "Price per unit BEFORE GST.", example: "45000" },
  "item.fulfillment_route": {
    title: "Where this item comes from. Drives whether it skips Production.",
    example: "Ready Stock = pull from warehouse · Custom = send to workshop",
  },

  // Measurement task
  "task.assigned_to": { title: "Measurement staff who will visit the site." },
  "task.requirement": { title: "What needs to be measured. Plain language is fine.", example: "Master bedroom wardrobe + study table" },

  // Trip
  "trip.route": { title: "Which delivery route this trip covers." },
  "trip.driver": { title: "Driver assigned to this trip. Only they can update stops on their phone." },
  "trip.date": { title: "Date the trip will run." },

  // Staff
  "staff.role": {
    title: "What this user can do in the app.",
    example: "Admin = everything · Staff = OPS · Measurement = site visits · Delivery = trips · Worker = production",
  },

  // Worker / Job
  "job.notes": { title: "Anything the worker needs to know — wood type, hardware, deadline.", example: "Use marine ply, deliver by 18th" },
};

export type ActionHelp = { hint: string; tone?: "info" | "warn" | "success" };

export const ACTION_HELP: Record<string, ActionHelp> = {
  "quotation.create": { hint: "Creates the quotation in Client Hub. Direct Deals jump straight to OPS; Custom Projects wait for site measurement.", tone: "info" },
  "quotation.submit_for_pricing": { hint: "Hands the file to OPS for final pricing. The Dimensions team can no longer edit items.", tone: "info" },
  "quotation.finalize": { hint: "Marks the quotation as confirmed. Ready-stock items move to Warehouse, custom items create Production jobs.", tone: "success" },
  "quotation.send_to_production": { hint: "Creates job work orders for the assigned worker. Worker gets it on their phone immediately.", tone: "info" },
  "quotation.share_whatsapp": { hint: "Opens WhatsApp with a customer-friendly link to view this quotation online.", tone: "info" },
  "quotation.delete": { hint: "Soft-deletes the quotation. Admins can restore it from Trash within 30 days.", tone: "warn" },
  "job.start": { hint: "Marks the job as 'In Progress'. Status appears live on the Production monitor.", tone: "info" },
  "job.mark_done": { hint: "Job moves to Warehouse for packing & dispatch.", tone: "success" },
  "warehouse.mark_ready": { hint: "Tells logistics this item is packed and waiting for a trip.", tone: "info" },
  "warehouse.mark_dispatched": { hint: "Closes the warehouse stage. Item is now considered Out for Delivery.", tone: "success" },
  "trip.start": { hint: "Driver app switches to navigation mode. Stops are unlocked in order.", tone: "info" },
  "trip.mark_delivered": { hint: "Marks this stop delivered, captures timestamp, and moves the quotation to 'Delivered'.", tone: "success" },
  "task.complete": { hint: "Sends the measurement to OPS for pricing. The file is no longer editable by Dimensions.", tone: "info" },
};

export type ManualSection = { title: string; bullets: string[] };

const COMMON_FAQ: ManualSection = {
  title: "Everyday FAQ",
  bullets: [
    "Forgot what a field means? Tap the small (?) icon next to it — every important field has a tooltip with an example.",
    "Stuck on a button? Read the small grey line below it — it tells you exactly what happens next.",
    "Can't find a quotation? Use the search box at the top of the Quotations list, or filter by stage from the Overview pipeline.",
    "Mistake? Most actions are reversible. Deleted items go to Trash for 30 days; only Admin can restore.",
  ],
};

export const ROLE_MANUALS: Record<AppRole, ManualSection[]> = {
  admin: [
    {
      title: "Your daily workflow",
      bullets: [
        "Open Overview to see live counts across all 6 pipeline stages.",
        "Click any stage card or KPI to drill into that exact list — no extra filtering needed.",
        "Use Pipeline Monitor for a side-by-side card view of every quotation and where it's stuck.",
        "Staff Monitor shows who is doing what today — useful for stand-ups.",
      ],
    },
    {
      title: "Common admin tasks",
      bullets: [
        "Add a new staff member: Staff → New User → pick a role.",
        "Change a user's role: Staff → click the user → Update Role.",
        "Restore a deleted record: Trash → Restore (30-day window).",
        "Edit homepage banners: Home Page → Hero Slides.",
        "Adjust receivables / pending dues: Backlog (triple-tap the logo to reveal).",
      ],
    },
    COMMON_FAQ,
  ],
  staff: [
    {
      title: "Your daily workflow (OPS)",
      bullets: [
        "Quotations marked 'OPS: Pending Pricing' are your queue. Open them, set unit prices, then click Finalize.",
        "Finalizing automatically routes ready-stock items to Warehouse and custom items to Production.",
        "If a customer pays an advance, enter it on the quotation — the file moves out of your queue automatically.",
      ],
    },
    {
      title: "Common OPS tasks",
      bullets: [
        "Create a quotation manually: Quotations → New quotation → pick Lead Type.",
        "Assign site measurement: Measurement Tasks → New Task → pick the measurement staff.",
        "Share a PDF with a customer: open the quotation → Share → WhatsApp.",
        "Plan a delivery: Trips → New Trip → add quotations as stops.",
      ],
    },
    COMMON_FAQ,
  ],
  measurement_staff: [
    {
      title: "Your daily workflow",
      bullets: [
        "Open My Work to see tasks assigned to you today.",
        "Visit the site, take measurements and photos, fill them into the draft quotation.",
        "When done, click Submit — this moves the file to OPS for pricing. You can no longer edit it after this.",
      ],
    },
    {
      title: "Tips",
      bullets: [
        "Always upload at least one site photo per item — OPS uses it to confirm the spec.",
        "Use the sketch pad if you need to draw a layout — it attaches to the item automatically.",
      ],
    },
    COMMON_FAQ,
  ],
  worker: [
    {
      title: "Your daily workflow",
      bullets: [
        "Log in on your phone with the PIN your supervisor gave you.",
        "You'll see only the jobs assigned to you. Tap a job to open it.",
        "Tap 'Start' when you begin, 'Mark Done' when finished. The office sees status live.",
        "After 'Mark Done', the warehouse takes over — you're done with that job.",
      ],
    },
    {
      title: "Tips",
      bullets: [
        "Never see your prices on the job card — that's intentional. Customer prices are hidden from production.",
        "If a measurement looks wrong, send a photo via the Issue button instead of guessing.",
      ],
    },
    COMMON_FAQ,
  ],
  delivery: [
    {
      title: "Your daily workflow",
      bullets: [
        "Open My Trips to see trips assigned to you today.",
        "Tap Start Trip when you leave the warehouse. Stops unlock in route order.",
        "At each stop: tap Mark Delivered, collect the balance, and move on.",
        "If pricing is hidden on a stop, ask office to flip the 'Show Price to Delivery' toggle for that quotation.",
      ],
    },
    {
      title: "Tips",
      bullets: [
        "Customer phone numbers and totals are visible only when admin enables them per quotation.",
        "If a delivery fails, mark the stop with an Issue note — admin will reschedule.",
      ],
    },
    COMMON_FAQ,
  ],
};

export const roleLabel = (role: AppRole): string =>
  ({
    admin: "Admin",
    staff: "Office / OPS",
    measurement_staff: "Measurement",
    worker: "Production Worker",
    delivery: "Delivery Driver",
  }[role]);