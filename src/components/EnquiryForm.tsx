import { trackLead } from "@/lib/track";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Check,
  ShoppingBag,
  Wand2,
  AlertTriangle,
  Wrench,
  Truck,
  HelpCircle,
  ChevronLeft,
  Upload,
  X,
  Phone,
  MapPin,
  User,
  Clock,
} from "lucide-react";
import { buildWhatsAppUrl, WHATSAPP_BUTTON_CLASS, WHATSAPP_NUMBER } from "@/lib/brand";
import { DEFAULT_MAPS_URL } from "@/lib/socialLinks";
import { SocialIcon } from "@/components/SocialLinks";
import {
  registerEnquiryOpener,
  type EnquiryOpenOpts,
} from "@/lib/enquiryForm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getAttribution } from "@/lib/attribution";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
type EnquiryType =
  | "new_purchase"
  | "custom_design"
  | "complaint_replacement"
  | "service_repair"
  | "delivery_installation"
  | "general_inquiry";

type Step = 1 | 2;
type FieldErrors = Record<string, string | undefined>;
// Order the fields appear on screen — used to focus the first one with a problem.
const FIELD_ORDER = ["name", "place", "phone", "billNumber", "itemDescription", "message", "workNeeded"];
type Status = "idle" | "submitting" | "success";

interface CategoryDef {
  value: EnquiryType;
  label: string;
  ml: string;
  Icon: typeof ShoppingBag;
  accent: string;
}

const CATEGORIES: CategoryDef[] = [
  { value: "new_purchase",          label: "New Purchase",            ml: "പുതിയ വാങ്ങൽ",      Icon: ShoppingBag, accent: "from-amber-500/15 to-amber-500/5 text-amber-700" },
  { value: "custom_design",         label: "Custom Design",           ml: "കസ്റ്റം ഡിസൈൻ",     Icon: Wand2,       accent: "from-violet-500/15 to-violet-500/5 text-violet-700" },
  { value: "complaint_replacement", label: "Complaint & Replacement", ml: "പരാതി / മാറ്റം",     Icon: AlertTriangle, accent: "from-rose-500/15 to-rose-500/5 text-rose-700" },
  { value: "service_repair",        label: "Service & Repair",        ml: "സർവീസ് / റിപ്പയർ",  Icon: Wrench,      accent: "from-sky-500/15 to-sky-500/5 text-sky-700" },
  { value: "delivery_installation", label: "Delivery & Installation", ml: "ഡെലിവറി / ഫിറ്റിംഗ്", Icon: Truck,       accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-700" },
  { value: "general_inquiry",       label: "General Inquiry",         ml: "പൊതുവായ ചോദ്യം",    Icon: HelpCircle,  accent: "from-slate-500/15 to-slate-500/5 text-slate-700" },
];

const TEAL = "#0E5C66";

// ────────────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────────────
const baseSchema = z.object({
  name: z.string().trim().min(2, "പേര് എഴുതുക · Enter your name").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "ശരിയായ ഫോൺ നമ്പർ എഴുതുക · Enter a valid phone number")
    .refine((v) => { const d = v.replace(/\D/g, "").length; return d >= 8 && d <= 15; }, "ശരിയായ ഫോൺ നമ്പർ എഴുതുക · Enter a valid phone number"),
  place: z.string().trim().min(2, "സ്ഥലം എഴുതുക · Enter your place").max(120),
});

const messageSchema = baseSchema.extend({
  message: z.string().trim().max(1000).optional().default(""),
});

const complaintSchema = baseSchema.extend({
  billNumber: z.string().trim().max(60).optional().default(""),
  message: z.string().trim().min(5, "പ്രശ്നം എന്താണെന്ന് എഴുതുക · Please describe the issue").max(1000),
});

const serviceSchema = baseSchema.extend({
  itemDescription: z.string().trim().min(2, "ഏത് സാധനമാണെന്ന് എഴുതുക · Tell us which item").max(300),
  workNeeded: z.string().trim().max(1000).optional().default(""),
});

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────
export const EnquiryForm = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [status, setStatus] = useState<Status>("idle");
  const [category, setCategory] = useState<EnquiryType | null>(null);

  // common fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [place, setPlace] = useState("");
  const [message, setMessage] = useState("");

  // complaint-only
  const [billNumber, setBillNumber] = useState("");
  const [photo, setPhoto] = useState<{ base64: string; name: string } | null>(null);

  // service-only
  const [itemDescription, setItemDescription] = useState("");
  const [workNeeded, setWorkNeeded] = useState("");

  // lead-only
  const [suggestedAmount, setSuggestedAmount] = useState<string>("");

  // success metadata
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [leadSource, setLeadSource] = useState<"website" | "manual">("website");

  // field name → message shown right under that field
  const [errors, setErrors] = useState<FieldErrors>({});
  const clearError = (field: string) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const reset = () => {
    setStep(1);
    setStatus("idle");
    setCategory(null);
    setName("");
    setPhone("");
    setPlace("");
    setMessage("");
    setBillNumber("");
    setPhoto(null);
    setItemDescription("");
    setWorkNeeded("");
    setSuggestedAmount("");
    setResultCode(null);
    setLeadSource("website");
    setErrors({});
  };

  // Opener registration. Pre-fill product-related enquiries as New Purchase
  // with the product name pre-mentioned in the message (kept lightweight —
  // the cart-style item builder is intentionally removed in the new flow).
  useEffect(() => {
    registerEnquiryOpener((opts: EnquiryOpenOpts = {}) => {
      reset();
      setOpen(true);
      setLeadSource(opts.source ?? "website");
      const prefName =
        opts.catalogProducts?.[0]?.productName || opts.productName;
      if (prefName) {
        setCategory("new_purchase");
        setMessage(`I'm interested in: ${prefName}`);
        setStep(2);
      }
    });
    return () => registerEnquiryOpener(null);
  }, []);

  // Deep-link: ?enquiry=1&product=...
  const handledDeepLink = useRef(false);
  useEffect(() => {
    if (handledDeepLink.current || typeof window === "undefined") return;
    handledDeepLink.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("enquiry") === "1" || params.get("enquiry") === "true") {
      const prod = params.get("product") || undefined;
      setTimeout(() => {
        reset();
        setOpen(true);
        if (prod) {
          setCategory("new_purchase");
          setMessage(`I'm interested in: ${prod}`);
          setStep(2);
        }
      }, 300);
    }
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (status === "submitting") return;
    setOpen(v);
    if (!v) setTimeout(reset, 200);
  };

  // ── Step transitions with validation ──────────────────────────────────────
  const schemaResult = () => {
    if (category === "complaint_replacement") {
      return complaintSchema.safeParse({ name, phone, place, billNumber, message });
    }
    if (category === "service_repair") {
      return serviceSchema.safeParse({ name, phone, place, itemDescription, workNeeded });
    }
    return messageSchema.safeParse({ name, phone, place, message });
  };

  // Shows each problem under its own field and moves the cursor to the first one.
  const validateStep2 = (): boolean => {
    if (!category) return false;
    const result = schemaResult();
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: FieldErrors = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !next[field]) next[field] = issue.message;
    }
    setErrors(next);
    const first = FIELD_ORDER.find((f) => next[f]);
    if (first) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`enq-${first}`);
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    return false;
  };

  // Checks one field when the customer leaves it, so mistakes show early.
  const validateField = (field: string) => {
    if (!category) return;
    const result = schemaResult();
    const issue = result.success ? undefined : result.error.issues.find((i) => i.path[0] === field);
    setErrors((prev) => ({ ...prev, [field]: issue?.message }));
  };

  // Two steps only: tapping a type moves straight on to the details, and the
  // details screen submits directly (no separate "Continue" or review screen).
  const chooseCategory = (v: EnquiryType) => {
    setCategory(v);
    setStep(2);
  };

  const goBack = () => setStep(1);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!category || !validateStep2()) return;
    setStatus("submitting");
    try {
      const parsedAmount = suggestedAmount.trim() ? parseFloat(suggestedAmount) : null;
      const { data, error } = await supabase.functions.invoke("create-enquiry", {
        body: {
          type: category,
          name: name.trim(),
          phone: phone.trim(),
          place: place.trim(),
          message: message.trim(),
          billNumber: billNumber.trim(),
          itemDescription: itemDescription.trim(),
          workNeeded: workNeeded.trim(),
          photoBase64: photo?.base64 ?? null,
          photoName: photo?.name ?? null,
          suggestedAmount: (parsedAmount && !isNaN(parsedAmount)) ? parsedAmount : null,
          source: leadSource,
          // which ad / visit brought this customer (staff-entered leads carry none)
          ...(leadSource === "website" ? getAttribution() : {}),
        },
      });
      if (error) {
        // Try to surface the server's actual error message instead of a generic one.
        let serverMsg: string | null = null;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            serverMsg = body?.error || body?.message || null;
          }
        } catch {
          /* ignore parse errors */
        }
        throw new Error(serverMsg || error.message || "Unknown error");
      }
      const code = (data as { code?: string } | null)?.code ?? null;
      setResultCode(code);
      setStatus("success");
      trackLead(category, { phone: phone.trim(), name: name.trim(), place: place.trim() });

      // Non-blocking n8n webhook — fires after success, never blocks or errors the user
      try {
        const cleanPhone = phone.trim().replace(/\D+/g, "");
        fetch("https://n8n.hitechfurniture.online/webhook/enquiry-suggested-amount", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: cleanPhone,
            customer_name: name.trim(),
            language: "en",
            items: [
              {
                description: message.trim() || itemDescription.trim() || "",
                qty: 1,
                suggested_amount: (parsedAmount && !isNaN(parsedAmount)) ? parsedAmount : null,
              },
            ],
          }),
        }).catch(() => {});
      } catch {
        // intentionally swallowed
      }
    } catch (err) {
      console.error("[Enquiry] submit failed", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Submission failed: ${msg}`);
      setStatus("idle");
    }
  };

  // ── Photo upload ─────────────────────────────────────────────────────────
  const handlePhotoChange = async (file: File | null) => {
    if (!file) return setPhoto(null);
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Photo must be under 4 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setPhoto({ base64: String(reader.result), name: file.name });
    reader.onerror = () => toast.error("Could not read the photo");
    reader.readAsDataURL(file);
  };

  const activeCategory = CATEGORIES.find((c) => c.value === category) ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[92vh] w-[95vw] overflow-y-auto p-0 sm:max-w-xl"
        closeClassName="text-white/80 hover:text-white"
      >
        {status === "success" ? (
          <SuccessView
            name={name}
            category={activeCategory?.label || "Enquiry"}
            code={resultCode}
            detail={message.trim() || itemDescription.trim()}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <>
            {/* Header */}
            <div
              className="px-6 py-6 text-white sm:px-8"
              style={{ background: TEAL }}
            >
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                HiTech Furniture &amp; Interiors
              </p>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-white sm:text-[26px]">
                  How can we help you?
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/80">
                  Tell us what you need — we&apos;ll contact you within 24 hours.
                </DialogDescription>
              </DialogHeader>
              <StepIndicator step={step} />
            </div>

            {/* Body */}
            <div className="space-y-5 px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
              {step === 1 && (
                <StepOne selected={category} onSelect={chooseCategory} />
              )}

              {step === 2 && category && (
                <StepTwo
                  category={category}
                  categoryLabel={activeCategory ? `${activeCategory.label} · ${activeCategory.ml}` : undefined}
                  name={name}
                  setName={setName}
                  phone={phone}
                  setPhone={setPhone}
                  place={place}
                  setPlace={setPlace}
                  message={message}
                  setMessage={setMessage}
                  billNumber={billNumber}
                  setBillNumber={setBillNumber}
                  photo={photo}
                  onPhotoChange={handlePhotoChange}
                  itemDescription={itemDescription}
                  setItemDescription={setItemDescription}
                  workNeeded={workNeeded}
                  setWorkNeeded={setWorkNeeded}
                  suggestedAmount={suggestedAmount}
                  setSuggestedAmount={setSuggestedAmount}
                  errors={errors}
                  clearError={clearError}
                  validateField={validateField}
                />
              )}

              {/* Nav — only on the details step; step 1 advances on tap */}
              {step === 2 && (
                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={goBack}
                      disabled={status === "submitting"}
                      className="h-12 shrink-0 px-3 text-slate-600"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={status === "submitting"}
                      className="h-12 flex-1 text-base font-semibold text-white"
                      style={{ background: TEAL }}
                    >
                      {status === "submitting" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        "Send enquiry"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    By sending you agree to be contacted by our team about this enquiry.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

const StepIndicator = ({ step }: { step: Step }) => (
  <div className="mt-5 flex items-center gap-2">
    {[1, 2].map((n) => (
      <div key={n} className={cn("flex items-center gap-2", n < 2 && "flex-1")}>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
            step >= n
              ? "bg-white text-[#0E5C66]"
              : "bg-white/15 text-white/60",
          )}
        >
          {step > n ? <Check className="h-3.5 w-3.5" /> : n}
        </div>
        {n < 2 && (
          <div
            className={cn(
              "h-px flex-1 transition",
              step > n ? "bg-white" : "bg-white/20",
            )}
          />
        )}
      </div>
    ))}
  </div>
);

const StepOne = ({
  selected,
  onSelect,
}: {
  selected: EnquiryType | null;
  onSelect: (v: EnquiryType) => void;
}) => (
  <div className="space-y-3">
    <div>
      <h3 className="text-base font-semibold text-slate-800">
        What do you need help with?
      </h3>
      <p className="mt-0.5 text-xs text-slate-500">ഒന്ന് തിരഞ്ഞെടുക്കൂ · Tap one to continue</p>
    </div>
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {CATEGORIES.map(({ value, label, ml, Icon, accent }) => {
        const sel = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
              "group flex items-start gap-3 rounded-xl border p-3.5 text-left transition",
              sel
                ? "border-[#0E5C66] bg-[#0E5C66]/5 ring-2 ring-[#0E5C66]/30"
                : "border-slate-200 bg-white hover:border-[#0E5C66]/40 hover:bg-slate-50",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                accent,
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">
                {label}
              </span>
              <span className="block text-[11px] text-slate-500">{ml}</span>
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

interface StepTwoProps {
  category: EnquiryType;
  categoryLabel?: string;
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  place: string; setPlace: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  billNumber: string; setBillNumber: (v: string) => void;
  photo: { base64: string; name: string } | null;
  onPhotoChange: (f: File | null) => void;
  itemDescription: string; setItemDescription: (v: string) => void;
  workNeeded: string; setWorkNeeded: (v: string) => void;
  suggestedAmount: string; setSuggestedAmount: (v: string) => void;
  errors: FieldErrors;
  clearError: (field: string) => void;
  validateField: (field: string) => void;
}

const StepTwo = (p: StepTwoProps) => {
  const isComplaint = p.category === "complaint_replacement";
  const isService = p.category === "service_repair";

  // Shared wiring for a validated input: id, error styling and screen-reader hints.
  const bind = (field: string, set: (v: string) => void) => ({
    id: `enq-${field}`,
    "aria-invalid": !!p.errors[field],
    "aria-describedby": p.errors[field] ? `enq-${field}-error` : undefined,
    className: cn("h-12 text-base", p.errors[field] && "border-rose-500 focus-visible:ring-rose-500"),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value); p.clearError(field); },
    onBlur: () => p.validateField(field),
  });
  const bindArea = (field: string, set: (v: string) => void) => ({
    id: `enq-${field}`,
    "aria-invalid": !!p.errors[field],
    "aria-describedby": p.errors[field] ? `enq-${field}-error` : undefined,
    className: cn("text-base", p.errors[field] && "border-rose-500 focus-visible:ring-rose-500"),
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => { set(e.target.value); p.clearError(field); },
    onBlur: () => p.validateField(field),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-800">Your details</h3>
        {p.categoryLabel && (
          <span className="rounded-full bg-[#0E5C66]/10 px-3 py-1 text-xs font-semibold text-[#0E5C66]">
            {p.categoryLabel}
          </span>
        )}
      </div>

      <Field field="name" label="Name" ml="പേര്" required icon={<User className="h-3.5 w-3.5" />} error={p.errors.name}>
        <Input
          {...bind("name", p.setName)}
          value={p.name}
          placeholder="Your full name"
          autoComplete="name"
          maxLength={100}
          autoFocus
        />
      </Field>

      <Field field="place" label="Place" ml="സ്ഥലം" required icon={<MapPin className="h-3.5 w-3.5" />} error={p.errors.place}>
        <Input
          {...bind("place", p.setPlace)}
          value={p.place}
          placeholder="City / Town"
          autoComplete="address-level2"
          maxLength={120}
        />
      </Field>

      <Field field="phone" label="Phone" ml="ഫോൺ നമ്പർ" required icon={<Phone className="h-3.5 w-3.5" />} error={p.errors.phone} hint="WhatsApp ഉള്ള നമ്പർ തരൂ · A number with WhatsApp is best">
        <Input
          {...bind("phone", p.setPhone)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={p.phone}
          placeholder="98765 43210"
          maxLength={20}
        />
      </Field>

      {/* Conditional fields */}
      {isComplaint && (
        <>
          <Field field="billNumber" label="Original bill / quotation number (optional)" ml="ബിൽ നമ്പർ">
            <Input
              id="enq-billNumber"
              className="h-12 text-base"
              value={p.billNumber}
              onChange={(e) => p.setBillNumber(e.target.value)}
              placeholder="e.g. 2026/27-014"
              maxLength={60}
            />
          </Field>
          <Field field="message" label="Issue description" ml="പ്രശ്നം" required error={p.errors.message}>
            <Textarea
              {...bindArea("message", p.setMessage)}
              value={p.message}
              placeholder="What went wrong? Please give us enough detail to help."
              rows={4}
              maxLength={1000}
            />
          </Field>
          <PhotoUpload photo={p.photo} onChange={p.onPhotoChange} />
        </>
      )}

      {isService && (
        <>
          <Field field="itemDescription" label="Item description" ml="ഏത് സാധനം" required error={p.errors.itemDescription}>
            <Input
              {...bind("itemDescription", p.setItemDescription)}
              value={p.itemDescription}
              placeholder="e.g. 6-seater dining table — teak"
              maxLength={300}
            />
          </Field>
          <Field field="workNeeded" label="Work needed" ml="ചെയ്യേണ്ട പണി">
            <Textarea
              id="enq-workNeeded"
              className="text-base"
              value={p.workNeeded}
              onChange={(e) => p.setWorkNeeded(e.target.value)}
              placeholder="What kind of service or repair?"
              rows={4}
              maxLength={1000}
            />
          </Field>
        </>
      )}

      {!isComplaint && !isService && (
        <>
          <Field field="message" label="Message / requirement" ml="നിങ്ങളുടെ ആവശ്യം" error={p.errors.message}>
            <Textarea
              {...bindArea("message", p.setMessage)}
              value={p.message}
              placeholder="Tell us a bit about what you're looking for"
              rows={4}
              maxLength={1000}
            />
          </Field>
          <Field field="suggestedAmount" label="Expected price (optional)" ml="പ്രതീക്ഷിക്കുന്ന വില">
            <Input
              id="enq-suggestedAmount"
              className="h-12 text-base"
              type="number"
              inputMode="decimal"
              value={p.suggestedAmount}
              onChange={(e) => p.setSuggestedAmount(e.target.value)}
              placeholder="e.g. 25000"
              min={0}
            />
          </Field>
          <PhotoUpload photo={p.photo} onChange={p.onPhotoChange} />
        </>
      )}
    </div>
  );
};

const Field = ({
  field,
  label,
  ml,
  required,
  icon,
  error,
  hint,
  children,
}: {
  field: string;
  label: string;
  /** Malayalam name of the field, shown beside the English one. */
  ml?: string;
  required?: boolean;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={`enq-${field}`} className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
      {icon}
      {label}
      {ml && <span className="text-[13px] font-medium normal-case tracking-normal text-slate-500">· {ml}</span>}
      {required && <span className="text-rose-600" aria-hidden="true">*</span>}
    </Label>
    {children}
    {error ? (
      <p id={`enq-${field}-error`} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-rose-700">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    ) : hint ? (
      <p className="text-xs text-slate-500">{hint}</p>
    ) : null}
  </div>
);

const PhotoUpload = ({
  photo,
  onChange,
}: {
  photo: { base64: string; name: string } | null;
  onChange: (f: File | null) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Photo (optional)
        <span className="text-[13px] font-medium normal-case tracking-normal text-slate-500">· ഫോട്ടോ</span>
      </Label>
      {photo ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
          <img
            src={photo.base64}
            alt={photo.name}
            className="h-14 w-14 rounded-md object-cover"
          />
          <div className="flex-1 truncate text-xs text-slate-600">
            {photo.name}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 transition hover:border-[#0E5C66]/40 hover:bg-white"
        >
          <Upload className="h-4 w-4" />
          Tap to add a photo (max 4 MB)
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
};

const SuccessView = ({
  name,
  category,
  code,
  detail,
  onClose,
}: {
  name: string;
  category: string;
  code: string | null;
  detail?: string;
  onClose: () => void;
}) => {
  // Lets the customer carry on the conversation straight away instead of
  // waiting for a call back.
  const waUrl = buildWhatsAppUrl(
    [
      `Hello Hitech Furniture, I just sent an enquiry on your website${code ? ` (Ref ${code})` : ""}.`,
      name ? `Name: ${name.trim()}` : "",
      detail ? detail.slice(0, 300) : "",
    ].filter(Boolean).join("\n"),
  );
  return (
    <div className="px-6 py-9 text-center sm:px-10 sm:py-11">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: `${TEAL}15` }}
      >
        <Check className="h-8 w-8" style={{ color: TEAL }} />
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold text-slate-900">
        Thank you{name ? `, ${name.trim().split(" ")[0]}` : ""}!
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
        Your {category.toLowerCase()} request has been received. We&apos;ll contact
        you within <span className="font-semibold text-slate-800">24 hours</span>.
      </p>
      {code && (
        <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          Reference: <span className="font-mono font-semibold text-slate-800">{code}</span>
        </p>
      )}

      <div className="mx-auto mt-6 max-w-sm space-y-3">
        <p className="text-sm font-medium text-slate-700">
          വേഗം മറുപടി വേണോ? WhatsApp-ൽ തുടരാം
        </p>
        <Button asChild size="lg" className={cn("h-12 w-full text-base font-semibold", WHATSAPP_BUTTON_CLASS)}>
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <SocialIcon k="whatsapp" className="mr-2 h-5 w-5" /> Continue on WhatsApp
          </a>
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="h-11 w-full">
            <a href={`tel:+${WHATSAPP_NUMBER}`}>
              <Phone className="mr-2 h-4 w-4" /> Call us
            </a>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full">
            <a href={DEFAULT_MAPS_URL} target="_blank" rel="noopener noreferrer">
              <MapPin className="mr-2 h-4 w-4" /> Showroom map
            </a>
          </Button>
        </div>
        <p className="flex items-start justify-center gap-1.5 text-xs leading-5 text-slate-500">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Edapetty, Kalpetta · Mon–Sat 9:30 AM – 8:30 PM · Sunday closed</span>
        </p>
      </div>

      <Button onClick={onClose} variant="ghost" className="mt-4 h-11 w-full text-slate-600 sm:w-auto sm:px-10">
        Close
      </Button>
    </div>
  );
};
