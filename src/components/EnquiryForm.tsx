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
  ChevronRight,
  Upload,
  X,
  Phone,
  MapPin,
  User,
} from "lucide-react";
import {
  registerEnquiryOpener,
  type EnquiryOpenOpts,
} from "@/lib/enquiryForm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

type Step = 1 | 2 | 3;
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
  name: z.string().trim().min(2, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number"),
  place: z.string().trim().min(2, "Place is required").max(120),
});

const messageSchema = baseSchema.extend({
  message: z.string().trim().max(1000).optional().default(""),
});

const complaintSchema = baseSchema.extend({
  billNumber: z.string().trim().max(60).optional().default(""),
  message: z.string().trim().min(5, "Please describe the issue").max(1000),
});

const serviceSchema = baseSchema.extend({
  itemDescription: z.string().trim().min(2, "Item description is required").max(300),
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
  };

  // Opener registration. Pre-fill product-related enquiries as New Purchase
  // with the product name pre-mentioned in the message (kept lightweight —
  // the cart-style item builder is intentionally removed in the new flow).
  useEffect(() => {
    registerEnquiryOpener((opts: EnquiryOpenOpts = {}) => {
      reset();
      setOpen(true);
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
  const validateStep2 = (): boolean => {
    if (!category) return false;
    try {
      if (category === "complaint_replacement") {
        complaintSchema.parse({ name, phone, place, billNumber, message });
      } else if (category === "service_repair") {
        serviceSchema.parse({ name, phone, place, itemDescription, workNeeded });
      } else {
        messageSchema.parse({ name, phone, place, message });
      }
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.issues[0]?.message || "Please check the form");
      }
      return false;
    }
  };

  const goNext = () => {
    if (step === 1) {
      if (!category) {
        toast.error("Please choose what you need help with");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

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
                <StepOne
                  selected={category}
                  onSelect={(v) => setCategory(v)}
                />
              )}

              {step === 2 && category && (
                <StepTwo
                  category={category}
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
                />
              )}

              {step === 3 && category && (
                <StepThree
                  category={category}
                  categoryLabel={activeCategory?.label || ""}
                  name={name}
                  phone={phone}
                  place={place}
                  message={message}
                  billNumber={billNumber}
                  itemDescription={itemDescription}
                  workNeeded={workNeeded}
                  hasPhoto={!!photo}
                />
              )}

              {/* Nav */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={goBack}
                  disabled={step === 1 || status === "submitting"}
                  className="text-slate-600"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    className="text-white"
                    style={{ background: TEAL }}
                  >
                    Continue <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={status === "submitting"}
                    className="min-w-[140px] text-white"
                    style={{ background: TEAL }}
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Submit Enquiry"
                    )}
                  </Button>
                )}
              </div>
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
    {[1, 2, 3].map((n) => (
      <div key={n} className="flex flex-1 items-center gap-2">
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
        {n < 3 && (
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
    <h3 className="text-base font-semibold text-slate-800">
      What do you need help with?
    </h3>
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
}

const StepTwo = (p: StepTwoProps) => {
  const isComplaint = p.category === "complaint_replacement";
  const isService = p.category === "service_repair";

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-800">Your details</h3>

      <Field label="Name" required icon={<User className="h-3.5 w-3.5" />}>
        <Input
          value={p.name}
          onChange={(e) => p.setName(e.target.value)}
          placeholder="Your full name"
          maxLength={100}
          autoFocus
        />
      </Field>

      <Field label="Place" required icon={<MapPin className="h-3.5 w-3.5" />}>
        <Input
          value={p.place}
          onChange={(e) => p.setPlace(e.target.value)}
          placeholder="City / Town"
          maxLength={120}
        />
      </Field>

      <Field label="Phone" required icon={<Phone className="h-3.5 w-3.5" />}>
        <Input
          type="tel"
          inputMode="tel"
          value={p.phone}
          onChange={(e) => p.setPhone(e.target.value)}
          placeholder="+91 …"
          maxLength={20}
        />
      </Field>

      {/* Conditional fields */}
      {isComplaint && (
        <>
          <Field label="Original bill / quotation number (optional)">
            <Input
              value={p.billNumber}
              onChange={(e) => p.setBillNumber(e.target.value)}
              placeholder="e.g. 2026/27-014"
              maxLength={60}
            />
          </Field>
          <Field label="Issue description" required>
            <Textarea
              value={p.message}
              onChange={(e) => p.setMessage(e.target.value)}
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
          <Field label="Item description" required>
            <Input
              value={p.itemDescription}
              onChange={(e) => p.setItemDescription(e.target.value)}
              placeholder="e.g. 6-seater dining table — teak"
              maxLength={300}
            />
          </Field>
          <Field label="Work needed">
            <Textarea
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
          <Field label="Message / requirement">
            <Textarea
              value={p.message}
              onChange={(e) => p.setMessage(e.target.value)}
              placeholder="Tell us a bit about what you're looking for"
              rows={4}
              maxLength={1000}
            />
          </Field>
          <Field label="Expected price (optional)">
            <Input
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

const StepThree = (p: {
  category: EnquiryType;
  categoryLabel: string;
  name: string;
  phone: string;
  place: string;
  message: string;
  billNumber: string;
  itemDescription: string;
  workNeeded: string;
  hasPhoto: boolean;
}) => {
  const rows: Array<[string, string]> = [
    ["Type", p.categoryLabel],
    ["Name", p.name],
    ["Phone", p.phone],
    ["Place", p.place],
  ];
  if (p.category === "complaint_replacement") {
    if (p.billNumber) rows.push(["Bill / Quotation #", p.billNumber]);
    rows.push(["Issue", p.message]);
    rows.push(["Photo attached", p.hasPhoto ? "Yes" : "No"]);
  } else if (p.category === "service_repair") {
    rows.push(["Item", p.itemDescription]);
    if (p.workNeeded) rows.push(["Work needed", p.workNeeded]);
  } else if (p.message) {
    rows.push(["Message", p.message]);
    rows.push(["Photo attached", p.hasPhoto ? "Yes" : "No"]);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-800">
        Review &amp; submit
      </h3>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
        <dl className="divide-y divide-slate-200 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-3 px-4 py-2.5">
              <dt className="text-slate-500">{k}</dt>
              <dd className="col-span-2 whitespace-pre-wrap break-words font-medium text-slate-800">
                {v || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-xs text-slate-500">
        By submitting you agree to be contacted by our team about this enquiry.
      </p>
    </div>
  );
};

const Field = ({
  label,
  required,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
      {icon}
      {label}
      {required && <span className="text-rose-500">*</span>}
    </Label>
    {children}
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
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Photo (optional)
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
  onClose,
}: {
  name: string;
  category: string;
  code: string | null;
  onClose: () => void;
}) => (
  <div className="px-6 py-10 text-center sm:px-10 sm:py-12">
    <div
      className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
      style={{ background: `${TEAL}15` }}
    >
      <Check className="h-8 w-8" style={{ color: TEAL }} />
    </div>
    <h2 className="mt-5 font-display text-2xl font-semibold text-slate-900">
      Thank you{name ? `, ${name.split(" ")[0]}` : ""}!
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
    <Button
      onClick={onClose}
      className="mt-7 w-full text-white sm:w-auto sm:px-10"
      style={{ background: TEAL }}
    >
      Done
    </Button>
  </div>
);