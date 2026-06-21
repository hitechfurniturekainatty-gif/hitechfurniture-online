import { useEffect, useMemo, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Loader2,
  Check,
  Sparkles,
  MessageCircle,
  UploadCloud,
  X,
  Plus,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Bed,
  Sofa,
  Utensils,
  Briefcase,
  Tv,
  Package,
  Layers,
  MoreHorizontal,
} from "lucide-react";
import {
  registerEnquiryOpener,
  ENQUIRY_ENDPOINT,
  type EnquiryOpenOpts,
  type CatalogProduct,
} from "@/lib/enquiryForm";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { handleEnterAsNext } from "@/lib/enterKeyNav";

// ---------- Types ----------
type Category =
  | ""
  | "New Purchase"
  | "Custom Design"
  | "Complaint & Replacement"
  | "Service & Repair"
  | "Delivery & Installation"
  | "General Inquiry";

type Status = "idle" | "submitting" | "success";
type Step = 1 | 2 | 3;

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  base64: string;
}

export interface EnquiryItem {
  id: string;
  itemType: string;
  quantity: number;
  productName?: string;
  productId?: string;
  productCode?: string;
  productImageUrl?: string;
  sizeOrCapacity: string; // "" → defaults to "Need suggestion" at submit
  material: string;       // "" → defaults to "Need suggestion" at submit
  budgetRange: string;    // "" → defaults to "Not specified" at submit
  upload?: UploadedFile;
  fromCatalog: boolean;
}

const NATURE_OPTIONS: { value: Exclude<Category, "">; ml: string }[] = [
  { value: "New Purchase", ml: "പുതിയ വാങ്ങൽ" },
  { value: "Custom Design", ml: "കസ്റ്റം ഡിസൈൻ" },
  { value: "Complaint & Replacement", ml: "പരാതി / മാറ്റം" },
  { value: "Service & Repair", ml: "സർവീസ് / റിപ്പയർ" },
  { value: "Delivery & Installation", ml: "ഡെലിവറി / ഫിറ്റിംഗ്" },
  { value: "General Inquiry", ml: "പൊതുവായ ചോദ്യം" },
];

const FURNITURE_TYPES: {
  value: string;
  label: string;
  ml: string;
  Icon: typeof Bed;
}[] = [
  { value: "Bed/Cot", label: "Bed / Cot", ml: "കട്ടിൽ", Icon: Bed },
  { value: "Mattress", label: "Mattress", ml: "മെത്ത", Icon: Layers },
  { value: "Dining table", label: "Dining table", ml: "ഡൈനിങ് ടേബിൾ", Icon: Utensils },
  { value: "Sofa set", label: "Sofa set", ml: "സോഫ", Icon: Sofa },
  { value: "Wardrobe", label: "Wardrobe", ml: "വാർഡ്രോബ്", Icon: Package },
  { value: "Study/Office table", label: "Study / Office", ml: "സ്റ്റഡി ടേബിൾ", Icon: Briefcase },
  { value: "TV unit", label: "TV unit", ml: "ടിവി യൂണിറ്റ്", Icon: Tv },
  { value: "Other", label: "Other", ml: "മറ്റുള്ളവ", Icon: MoreHorizontal },
];

const SIZE_OPTIONS_BY_TYPE: Record<string, string[]> = {
  "Bed/Cot": ["King 6x6.5ft", "Queen 5x6.5ft", "Single 3x6.5ft"],
  "Dining table": ["4-seater", "6-seater", "8-seater"],
  "Sofa set": ["L-shape corner", "3+1+1"],
};
const MATERIAL_OPTIONS = ["teak", "rosewood", "mahogany", "plywood-MDF", "need_suggestion"];
const MATERIAL_LABELS: Record<string, string> = {
  teak: "Teak",
  rosewood: "Rosewood",
  mahogany: "Mahogany",
  "plywood-MDF": "Plywood / MDF",
  need_suggestion: "Need suggestion",
};
const BUDGET_OPTIONS = ["<50k", "50k-1L", "1L-3L", ">3L", "not_specified"];
const BUDGET_LABELS: Record<string, string> = {
  "<50k": "< ₹50k",
  "50k-1L": "₹50k – 1L",
  "1L-3L": "₹1L – 3L",
  ">3L": "> ₹3L",
  not_specified: "Not specified",
};

const DEFAULT_SIZE = "Need suggestion";
const DEFAULT_MATERIAL = "need_suggestion";
const DEFAULT_BUDGET = "not_specified";

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB per file — keeps Apps Script payload small

const cryptoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const labelForMaterial = (v: string) => MATERIAL_LABELS[v] ?? v;
const labelForBudget = (v: string) => BUDGET_LABELS[v] ?? v;

const newItem = (partial: Partial<EnquiryItem> = {}): EnquiryItem => ({
  id: cryptoId(),
  itemType: "Other",
  quantity: 1,
  sizeOrCapacity: "",
  material: "",
  budgetRange: "",
  fromCatalog: false,
  ...partial,
});

const composeItemDescription = (it: {
  productName?: string | null;
  itemType: string;
  quantity: number;
  sizeOrCapacity: string;
  material: string;
  budgetRange: string;
}) => {
  const name = it.productName || it.itemType || "Item";
  const size = it.sizeOrCapacity || DEFAULT_SIZE;
  const material = labelForMaterial(it.material || DEFAULT_MATERIAL);
  const budget = labelForBudget(it.budgetRange || DEFAULT_BUDGET);
  return `${name} x${it.quantity} — ${size} · ${material} · ${budget}`;
};

// ---------- Component ----------
export const EnquiryForm = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [status, setStatus] = useState<Status>("idle");

  // Step 1 — customer
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(true);

  // Step 2 — category + cart seeding
  const [category, setCategory] = useState<Category>("");
  const [items, setItems] = useState<EnquiryItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [shortNote, setShortNote] = useState("");

  // Legacy section state — used for the 4 non-cart categories.
  const [complaint, setComplaint] = useState({
    invoiceNumber: "",
    purchaseDate: "",
    issueType: "",
    issueTypeOther: "",
    description: "",
    proofFiles: [] as UploadedFile[],
  });
  const [service, setService] = useState({
    billNumber: "",
    serviceType: "",
    serviceTypeOther: "",
    condition: "",
    preferredDate: "",
  });
  const [delivery, setDelivery] = useState({
    orderId: "",
    address: "",
    mapLink: "",
    assembly: "",
    floor: "",
    floorOther: "",
  });
  const [general, setGeneral] = useState({ subject: "", message: "" });

  const resetAll = () => {
    setCustomerName("");
    setPhone("");
    setLocation("");
    setWhatsapp("");
    setSameAsPhone(true);
    setCategory("");
    setItems([]);
    setEditingItemId(null);
    setShortNote("");
    setComplaint({
      invoiceNumber: "",
      purchaseDate: "",
      issueType: "",
      issueTypeOther: "",
      description: "",
      proofFiles: [],
    });
    setService({
      billNumber: "",
      serviceType: "",
      serviceTypeOther: "",
      condition: "",
      preferredDate: "",
    });
    setDelivery({
      orderId: "",
      address: "",
      mapLink: "",
      assembly: "",
      floor: "",
      floorOther: "",
    });
    setGeneral({ subject: "", message: "" });
    setStep(1);
  };

  // Opener — accepts catalogProducts[] and back-compat single product.
  useEffect(() => {
    registerEnquiryOpener((opts: EnquiryOpenOpts = {}) => {
      const list: CatalogProduct[] =
        opts.catalogProducts && opts.catalogProducts.length > 0
          ? opts.catalogProducts
          : opts.productName || opts.productId
            ? [
                {
                  productName: opts.productName,
                  productId: opts.productId,
                },
              ]
            : [];
      resetAll();
      setStatus("idle");
      setOpen(true);
      if (list.length > 0) {
        setCategory("New Purchase");
        setItems(
          list.map((p) =>
            newItem({
              itemType: p.productName || "Other",
              productName: p.productName,
              productId: p.productId,
              productCode: p.productCode,
              productImageUrl: p.productImageUrl,
              fromCatalog: true,
            }),
          ),
        );
      }
    });
    return () => registerEnquiryOpener(null);
  }, []);

  // Hydrate missing image/code for catalog items (when only productId was passed).
  useEffect(() => {
    const need = items.filter(
      (it) => it.productId && (!it.productImageUrl || !it.productCode),
    );
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const it of need) {
        const { data } = await supabase
          .from("products")
          .select("product_code, product_images(image_url, display_order)")
          .eq("id", it.productId!)
          .maybeSingle();
        if (cancelled || !data) continue;
        const imgs = (data.product_images ?? [])
          .slice()
          .sort(
            (
              a: { display_order: number },
              b: { display_order: number },
            ) => a.display_order - b.display_order,
          );
        const cover = imgs[0]?.image_url;
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id
              ? {
                  ...p,
                  productCode: p.productCode ?? data.product_code ?? undefined,
                  productImageUrl: p.productImageUrl ?? cover ?? undefined,
                }
              : p,
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Deep-link: ?enquiry=1&product=Sofa
  const handledDeepLink = useRef(false);
  useEffect(() => {
    if (handledDeepLink.current) return;
    handledDeepLink.current = true;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("enquiry") === "1" || params.get("enquiry") === "true") {
      const prod = params.get("product") || undefined;
      setTimeout(() => {
        resetAll();
        if (prod) {
          setCategory("New Purchase");
          setItems([
            newItem({ itemType: prod, productName: prod, fromCatalog: true }),
          ]);
        }
        setStatus("idle");
        setOpen(true);
      }, 300);
    }
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (status === "submitting") return;
    setOpen(v);
    if (!v) {
      setTimeout(() => {
        resetAll();
        setStatus("idle");
      }, 200);
    }
  };

  const showCart =
    category === "New Purchase" || category === "Custom Design";
  const step1Ready =
    !!customerName.trim() && !!phone.trim() && !!location.trim();
  const step2Ready = !!category;
  const effectiveWhatsapp = (sameAsPhone ? phone : whatsapp).trim();

  const selectedTypes = useMemo(
    () =>
      new Set(
        items.filter((it) => !it.fromCatalog).map((it) => it.itemType),
      ),
    [items],
  );

  const toggleFurnitureType = (val: string) => {
    setItems((prev) => {
      const matchIdx = prev.findIndex(
        (it) => !it.fromCatalog && it.itemType === val,
      );
      if (matchIdx >= 0) return prev.filter((_, i) => i !== matchIdx);
      return [...prev, newItem({ itemType: val })];
    });
  };

  const goNext = () => {
    if (step === 1) {
      if (!step1Ready) {
        toast({
          title: "Please fill name, phone, and location.",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!step2Ready) {
        toast({
          title: "Please choose an enquiry type.",
          variant: "destructive",
        });
        return;
      }
      setStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleSubmit = async () => {
    if (!step1Ready) {
      toast({
        title: "Please fill name, phone, and location.",
        variant: "destructive",
      });
      setStep(1);
      return;
    }
    if (!category) {
      toast({
        title: "Please choose an enquiry type.",
        variant: "destructive",
      });
      setStep(2);
      return;
    }
    setStatus("submitting");

    // Normalize items: apply silent defaults + pre-compose the structured
    // one-line description that the Supabase edge function persists.
    const normalizedItems = items.map((it) => {
      const normalized = {
        id: it.id,
        itemType: it.itemType || "Other",
        quantity: Math.max(1, Number(it.quantity) || 1),
        productName: it.productName || null,
        productId: it.productId || null,
        productCode: it.productCode || null,
        productImageUrl: it.productImageUrl || null,
        sizeOrCapacity: it.sizeOrCapacity || DEFAULT_SIZE,
        material: it.material || DEFAULT_MATERIAL,
        budgetRange: it.budgetRange || DEFAULT_BUDGET,
        uploadImageBase64: it.upload?.base64 || null,
        uploadImageName: it.upload?.name || null,
        fromCatalog: it.fromCatalog,
        description: "",
      };
      normalized.description = composeItemDescription(normalized);
      return normalized;
    });

    const details: Record<string, unknown> = {};
    if (category === "New Purchase")
      details.newPurchase = {
        selectedFurnitureTypes: [...selectedTypes],
      };
    else if (category === "Custom Design")
      details.customDesign = {
        selectedFurnitureTypes: [...selectedTypes],
      };
    else if (category === "Complaint & Replacement")
      details.complaint = complaint;
    else if (category === "Service & Repair") details.service = service;
    else if (category === "Delivery & Installation")
      details.delivery = delivery;
    else if (category === "General Inquiry") details.general = general;

    const summary = buildSummaryMessage(
      category,
      details,
      normalizedItems,
      shortNote,
    );

    const payload = {
      // Back-compat flat fields the existing Apps Script already reads.
      customerName: customerName.trim(),
      phone: phone.trim(),
      whatsapp: effectiveWhatsapp || phone.trim(),
      location: location.trim(),
      enquiryType: category,
      productName:
        normalizedItems[0]?.productName ??
        normalizedItems[0]?.itemType ??
        category,
      message: summary,
      // Full structured payload — every single field the form collected,
      // nothing trimmed. The Google Sheet uses this for follow-up.
      category,
      details,
      items: normalizedItems,
      shortNote: shortNote.trim(),
      sameAsPhone,
      submittedAt: new Date().toISOString(),
      source:
        typeof window !== "undefined" ? window.location.href : "",
    };

    try {
      await Promise.allSettled([
        fetch(ENQUIRY_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        }),
        supabase.functions.invoke("create-enquiry-lead", {
          body: {
            customerName: customerName.trim(),
            phone: phone.trim(),
            whatsapp: effectiveWhatsapp || phone.trim(),
            location: location.trim(),
            category,
            summary,
            shortNote: shortNote.trim(),
            details,
            items: normalizedItems,
            // Legacy single-product hints used by current edge function.
            productId: normalizedItems[0]?.productId ?? null,
            productName: normalizedItems[0]?.productName ?? null,
            productImage: normalizedItems[0]?.productImageUrl ?? null,
            productCode: normalizedItems[0]?.productCode ?? null,
          },
        }),
      ]);
      setStatus("success");
    } catch (err) {
      console.error("[Enquiry] submit failed:", err);
      toast({
        title: "Submission failed",
        description: "Please check your internet and try again.",
        variant: "destructive",
      });
      setStatus("idle");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-xl">
        {status === "success" ? (
          <SuccessView
            name={customerName}
            category={category || "Enquiry"}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <>
            {/* Charcoal header + step indicator */}
            <div className="bg-[#2c3e50] px-6 py-6 text-white sm:px-8">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                HitecH Furniture
              </p>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-white sm:text-[26px]">
                  Smart Inquiry &amp; Support
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/75">
                  Tell us what you need — we&apos;ll respond on WhatsApp shortly.
                </DialogDescription>
              </DialogHeader>
              <StepIndicator step={step} />
            </div>

            <div
              className="relative space-y-5 px-6 pb-6 pt-5 sm:px-8 sm:pb-8"
              onKeyDown={
                step === 1
                  ? (e) => handleEnterAsNext(e, goNext)
                  : undefined
              }
            >
              {step === 1 && (
                <div className="space-y-4">
                  <SectionHeading
                    title="Your Details"
                    subtitle="Just the basics — takes 10 seconds"
                  />
                  <Field label="Name" ml="പേര്" required>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your full name"
                      maxLength={100}
                      autoFocus
                      required
                    />
                  </Field>
                  <Field label="Place" ml="സ്ഥലം" required>
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City / Town"
                      maxLength={120}
                      required
                    />
                  </Field>
                  <Field label="Phone" ml="ഫോൺ നമ്പർ" required>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 …"
                      maxLength={20}
                      required
                    />
                  </Field>
                  <div className="space-y-2">
                    <Field
                      label="WhatsApp number"
                      ml="വാട്സാപ്പ് നമ്പർ"
                    >
                      <Input
                        type="tel"
                        inputMode="numeric"
                        value={sameAsPhone ? phone : whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        disabled={sameAsPhone}
                        placeholder="+91 …"
                        maxLength={20}
                      />
                    </Field>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                      <Checkbox
                        checked={sameAsPhone}
                        onCheckedChange={(v) => setSameAsPhone(!!v)}
                      />
                      Same as phone number
                    </label>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <SectionHeading
                    title="Enquiry Type"
                    subtitle="നിങ്ങളുടെ ആവശ്യം"
                  />
                  <Field
                    label="What can we help you with?"
                    ml="തിരഞ്ഞെടുക്കുക"
                    required
                  >
                    <Select
                      value={category}
                      onValueChange={(v) => setCategory(v as Category)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option…" />
                      </SelectTrigger>
                      <SelectContent>
                        {NATURE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            <span className="font-medium">{o.value}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({o.ml})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {showCart && (
                    <div className="space-y-2">
                      <Label className="flex items-baseline gap-1.5 text-sm font-semibold text-slate-700">
                        Pick the furniture types you need
                        <span className="text-[11px] font-normal text-slate-400">
                          (tap any — multiple OK)
                        </span>
                      </Label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {FURNITURE_TYPES.map(
                          ({ value, label, ml, Icon }) => {
                            const sel = selectedTypes.has(value);
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => toggleFurnitureType(value)}
                                className={cn(
                                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition",
                                  sel
                                    ? "border-[#2c3e50] bg-[#2c3e50] text-white shadow-md"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-[#2c3e50]/40 hover:bg-slate-50",
                                )}
                              >
                                <Icon className="h-5 w-5" />
                                <span className="text-xs font-semibold leading-tight">
                                  {label}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px] leading-none",
                                    sel
                                      ? "text-white/80"
                                      : "text-slate-400",
                                  )}
                                >
                                  {ml}
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        You can fine-tune each item on the next step.
                      </p>
                    </div>
                  )}

                  {category === "Complaint & Replacement" && (
                    <ConditionalBlock
                      title="Complaint Details"
                      ml="പരാതി വിവരങ്ങൾ"
                    >
                      <Field label="Invoice / Bill Number">
                        <Input
                          value={complaint.invoiceNumber}
                          onChange={(e) =>
                            setComplaint((s) => ({
                              ...s,
                              invoiceNumber: e.target.value,
                            }))
                          }
                          placeholder="Bill #"
                        />
                      </Field>
                      <Field label="Date of Purchase">
                        <Input
                          type="date"
                          value={complaint.purchaseDate}
                          onChange={(e) =>
                            setComplaint((s) => ({
                              ...s,
                              purchaseDate: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Type of Issue">
                        <Select
                          value={complaint.issueType}
                          onValueChange={(v) =>
                            setComplaint((s) => ({ ...s, issueType: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose issue…" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Damaged Wood / Crack",
                              "Foam / Cushion Sagging",
                              "Wrong Color Delivered",
                              "Missing Parts / Screws",
                              "Others",
                            ].map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {complaint.issueType === "Others" && (
                          <Input
                            className="mt-2"
                            value={complaint.issueTypeOther}
                            onChange={(e) =>
                              setComplaint((s) => ({
                                ...s,
                                issueTypeOther: e.target.value,
                              }))
                            }
                            placeholder="Please describe the issue type"
                          />
                        )}
                      </Field>
                      <Field label="Detailed Description of Issue">
                        <Textarea
                          rows={3}
                          value={complaint.description}
                          onChange={(e) =>
                            setComplaint((s) => ({
                              ...s,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Describe what happened…"
                        />
                      </Field>
                      <FileField
                        label="Upload Proof of Damage"
                        helper="Photos/videos help us verify the issue."
                        accept="image/*,video/*"
                        multiple
                        files={complaint.proofFiles}
                        onChange={(files) =>
                          setComplaint((s) => ({ ...s, proofFiles: files }))
                        }
                      />
                    </ConditionalBlock>
                  )}

                  {category === "Service & Repair" && (
                    <ConditionalBlock
                      title="Service Details"
                      ml="സർവീസ് വിവരങ്ങൾ"
                    >
                      <Field label="Original Bill Number">
                        <Input
                          value={service.billNumber}
                          onChange={(e) =>
                            setService((s) => ({
                              ...s,
                              billNumber: e.target.value,
                            }))
                          }
                          placeholder="Bill # (if available)"
                        />
                      </Field>
                      <Field label="Type of Service Required">
                        <Select
                          value={service.serviceType}
                          onValueChange={(v) =>
                            setService((s) => ({ ...s, serviceType: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose service…" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Re-Polishing Work",
                              "Cushion / Fabric Change",
                              "Shifting & Re-fixing",
                              "Others",
                            ].map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {service.serviceType === "Others" && (
                          <Input
                            className="mt-2"
                            value={service.serviceTypeOther}
                            onChange={(e) =>
                              setService((s) => ({
                                ...s,
                                serviceTypeOther: e.target.value,
                              }))
                            }
                            placeholder="Please specify the service you need"
                          />
                        )}
                      </Field>
                      <Field label="Current Furniture Condition">
                        <Textarea
                          rows={3}
                          value={service.condition}
                          onChange={(e) =>
                            setService((s) => ({
                              ...s,
                              condition: e.target.value,
                            }))
                          }
                          placeholder="Describe the current state of the item…"
                        />
                      </Field>
                      <Field label="Preferred Service Date">
                        <Input
                          type="date"
                          value={service.preferredDate}
                          onChange={(e) =>
                            setService((s) => ({
                              ...s,
                              preferredDate: e.target.value,
                            }))
                          }
                        />
                      </Field>
                    </ConditionalBlock>
                  )}

                  {category === "Delivery & Installation" && (
                    <ConditionalBlock
                      title="Delivery Details"
                      ml="ഡെലിവറി വിവരങ്ങൾ"
                    >
                      <Field label="Order ID / Invoice Number">
                        <Input
                          value={delivery.orderId}
                          onChange={(e) =>
                            setDelivery((s) => ({
                              ...s,
                              orderId: e.target.value,
                            }))
                          }
                          placeholder="Order / Invoice #"
                        />
                      </Field>
                      <Field label="Exact Delivery Address">
                        <Textarea
                          rows={3}
                          value={delivery.address}
                          onChange={(e) =>
                            setDelivery((s) => ({
                              ...s,
                              address: e.target.value,
                            }))
                          }
                          placeholder="Full address with landmarks…"
                        />
                      </Field>
                      <Field label="Google Map Link or Landmark">
                        <Input
                          value={delivery.mapLink}
                          onChange={(e) =>
                            setDelivery((s) => ({
                              ...s,
                              mapLink: e.target.value,
                            }))
                          }
                          placeholder="https://maps.app.goo.gl/…"
                        />
                      </Field>
                      <Field label="Carpenter Assembly Required?">
                        <Select
                          value={delivery.assembly}
                          onValueChange={(v) =>
                            setDelivery((s) => ({ ...s, assembly: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">
                              Yes (കാർപെന്ററെ അയക്കണം)
                            </SelectItem>
                            <SelectItem value="No">
                              No (ഞങ്ങൾ ചെയ്തോളാം)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Floor Details">
                        <Select
                          value={delivery.floor}
                          onValueChange={(v) =>
                            setDelivery((s) => ({ ...s, floor: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select floor…" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "Ground Floor",
                              "1st Floor (No Lift)",
                              "2nd Floor (No Lift)",
                              "3rd Floor (No Lift)",
                              "With Lift Access",
                              "Others",
                            ].map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {delivery.floor === "Others" && (
                          <Input
                            className="mt-2"
                            value={delivery.floorOther}
                            onChange={(e) =>
                              setDelivery((s) => ({
                                ...s,
                                floorOther: e.target.value,
                              }))
                            }
                            placeholder="Please specify floor details"
                          />
                        )}
                      </Field>
                    </ConditionalBlock>
                  )}

                  {category === "General Inquiry" && (
                    <ConditionalBlock
                      title="General Inquiry"
                      ml="മറ്റു വിവരങ്ങൾ"
                    >
                      <Field label="Subject">
                        <Input
                          value={general.subject}
                          onChange={(e) =>
                            setGeneral((s) => ({
                              ...s,
                              subject: e.target.value,
                            }))
                          }
                          placeholder="e.g., Showroom Location, Current Offers"
                        />
                      </Field>
                      <Field label="Your Message">
                        <Textarea
                          rows={4}
                          value={general.message}
                          onChange={(e) =>
                            setGeneral((s) => ({
                              ...s,
                              message: e.target.value,
                            }))
                          }
                          placeholder="How can we help?"
                        />
                      </Field>
                    </ConditionalBlock>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  {showCart && (
                    <>
                      <SectionHeading
                        title="Your Cart"
                        subtitle="Tap any item to add specs — all optional"
                      />
                      {items.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
                          <ImagePlus className="mx-auto h-7 w-7 text-slate-400" />
                          <p className="mt-2 text-sm font-medium text-slate-700">
                            No items yet
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Go back to pick furniture types, or add a custom item below.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              const it = newItem({});
                              setItems((prev) => [...prev, it]);
                              setEditingItemId(it.id);
                            }}
                          >
                            <Plus className="h-4 w-4" /> Add item
                          </Button>
                        </div>
                      ) : (
                        <>
                          <ul className="space-y-2">
                            {items.map((it, idx) => (
                              <ItemRow
                                key={it.id}
                                item={it}
                                index={idx}
                                expanded={editingItemId === it.id}
                                onExpand={() =>
                                  setEditingItemId(
                                    editingItemId === it.id ? null : it.id,
                                  )
                                }
                                onChange={(patch) =>
                                  setItems((prev) =>
                                    prev.map((x) =>
                                      x.id === it.id ? { ...x, ...patch } : x,
                                    ),
                                  )
                                }
                                onRemove={() => {
                                  setItems((prev) =>
                                    prev.filter((x) => x.id !== it.id),
                                  );
                                  if (editingItemId === it.id)
                                    setEditingItemId(null);
                                }}
                                onDone={() => setEditingItemId(null)}
                              />
                            ))}
                          </ul>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              const it = newItem({});
                              setItems((prev) => [...prev, it]);
                              setEditingItemId(it.id);
                            }}
                          >
                            <Plus className="h-4 w-4" /> Add another item
                          </Button>
                        </>
                      )}
                    </>
                  )}

                  <Field
                    label="Any short note? (Optional)"
                    ml="കൂടുതൽ വിവരങ്ങൾ"
                  >
                    <Textarea
                      rows={3}
                      value={shortNote}
                      onChange={(e) => setShortNote(e.target.value)}
                      placeholder="Tell us anything else — colors, deadlines, room context…"
                    />
                  </Field>
                </div>
              )}

              {/* Nav buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    disabled={status === "submitting"}
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                ) : (
                  <span />
                )}

                {step < 3 ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={goNext}
                    className="bg-[#2c3e50] text-white hover:bg-[#1f2d3d] sm:min-w-[160px]"
                    disabled={
                      (step === 1 && !step1Ready) ||
                      (step === 2 && !step2Ready)
                    }
                  >
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleSubmit}
                    className="bg-[#2c3e50] text-white shadow-md hover:bg-[#1f2d3d] sm:min-w-[200px]"
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Submitting…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" /> Submit Request
                      </>
                    )}
                  </Button>
                )}
              </div>

              {status === "submitting" && <SkeletonOverlay />}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ---------- Sub-components ----------

const StepIndicator = ({ step }: { step: Step }) => {
  const total = 3;
  return (
    <div className="mt-4 flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <div key={n} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition",
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-white text-[#2c3e50]"
                    : "bg-white/15 text-white/70",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : n}
            </div>
            {i < total - 1 && (
              <div
                className={cn(
                  "h-px w-6",
                  done ? "bg-emerald-400" : "bg-white/20",
                )}
              />
            )}
          </div>
        );
      })}
      <span className="ml-2 text-[11px] uppercase tracking-wider text-white/70">
        Step {step} of {total}
      </span>
    </div>
  );
};

const SectionHeading = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => (
  <div className="border-l-2 border-[#2c3e50] pl-3">
    <p className="font-display text-lg font-semibold text-[#2c3e50]">
      {title}
    </p>
    {subtitle && (
      <p className="text-xs font-medium tracking-wide text-slate-500">
        {subtitle}
      </p>
    )}
  </div>
);

const Field = ({
  label,
  ml,
  required,
  className,
  children,
}: {
  label: string;
  ml?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="flex items-baseline gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      {ml && (
        <span className="text-[11px] font-normal text-slate-400">({ml})</span>
      )}
      {required && <span className="text-rose-500">*</span>}
    </Label>
    {children}
  </div>
);

const ConditionalBlock = ({
  title,
  ml,
  children,
}: {
  title: string;
  ml: string;
  children: React.ReactNode;
}) => (
  <div
    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    style={{ animation: "enquiry-section-in 320ms ease-out" }}
  >
    <SectionHeading title={title} subtitle={ml} />
    <style>{`
      @keyframes enquiry-section-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    {children}
  </div>
);

const FileField = ({
  label,
  helper,
  accept,
  multiple,
  files,
  onChange,
}: {
  label: string;
  helper?: string;
  accept?: string;
  multiple?: boolean;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    const accepted: UploadedFile[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) {
        toast({
          title: `${f.name} is too large`,
          description: "Max 4MB per file.",
          variant: "destructive",
        });
        continue;
      }
      const base64 = await readAsDataUrl(f);
      accepted.push({ name: f.name, size: f.size, type: f.type, base64 });
    }
    onChange(multiple ? [...files, ...accepted] : accepted.slice(0, 1));
    if (inputRef.current) inputRef.current.value = "";
  };
  return (
    <Field label={label}>
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 text-center transition hover:border-[#2c3e50]/40 hover:bg-slate-50"
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud className="h-6 w-6 text-slate-500" />
        <p className="text-sm font-medium text-slate-700">
          Click to upload {multiple ? "files" : "a file"}
        </p>
        {helper && <p className="text-xs text-slate-500">{helper}</p>}
        <p className="text-[11px] text-slate-400">Max 4MB each</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <span className="truncate font-medium text-slate-700">
                {f.name}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange(files.filter((_, idx) => idx !== i))
                }
                className="text-slate-400 hover:text-rose-500"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
};

const ItemRow = ({
  item,
  index,
  expanded,
  onExpand,
  onChange,
  onRemove,
  onDone,
}: {
  item: EnquiryItem;
  index: number;
  expanded: boolean;
  onExpand: () => void;
  onChange: (patch: Partial<EnquiryItem>) => void;
  onRemove: () => void;
  onDone: () => void;
}) => {
  const sizeOpts = SIZE_OPTIONS_BY_TYPE[item.itemType];
  const sizeIsStandard =
    !!sizeOpts && sizeOpts.includes(item.sizeOrCapacity);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast({
        title: `${file.name} is too large`,
        description: "Max 4MB per image.",
        variant: "destructive",
      });
      return;
    }
    const base64 = await readAsDataUrl(file);
    onChange({
      upload: {
        name: file.name,
        size: file.size,
        type: file.type,
        base64,
      },
    });
  };

  const preview = item.upload?.base64 || item.productImageUrl;
  const summaryBits = [
    item.sizeOrCapacity,
    item.material ? labelForMaterial(item.material) : "",
    item.budgetRange ? labelForBudget(item.budgetRange) : "",
  ].filter(Boolean);
  const summaryText =
    summaryBits.length > 0
      ? summaryBits.join(" · ")
      : "Tap to add size, material, budget";
  const title = item.productName || item.itemType || "Item";

  if (!expanded) {
    return (
      <li>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 transition hover:border-[#2c3e50]/30">
          <button
            type="button"
            onClick={onExpand}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-400">
              {preview ? (
                <img
                  src={preview}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {index + 1}. {title}{" "}
                <span className="font-normal text-slate-500">
                  × {item.quantity}
                </span>
                {item.fromCatalog && (
                  <span className="ml-2 rounded bg-[#2c3e50]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#2c3e50]">
                    catalog
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-slate-500">{summaryText}</p>
            </div>
            <Pencil className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
            aria-label="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-[#2c3e50]/30 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <label
          className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-[#2c3e50]/50"
          title="Upload reference photo"
        >
          {preview ? (
            <img
              src={preview}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-center text-[10px]">
              <ImagePlus className="h-5 w-5" />
              <span>Photo</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              handleUpload(e.target.files?.[0] ?? null)
            }
          />
        </label>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={item.productName ?? ""}
            onChange={(e) => onChange({ productName: e.target.value })}
            placeholder={
              item.fromCatalog
                ? "Product name"
                : "Item name (optional)"
            }
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-500">Type</Label>
            <Select
              value={item.itemType}
              onValueChange={(v) =>
                onChange({ itemType: v, sizeOrCapacity: "" })
              }
            >
              <SelectTrigger className="h-9 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FURNITURE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-xs text-slate-500">Qty</Label>
            <Input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) =>
                onChange({
                  quantity: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="h-9 w-16"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Size / Capacity">
          {sizeOpts ? (
            <>
              <Select
                value={sizeIsStandard ? item.sizeOrCapacity : ""}
                onValueChange={(v) => onChange({ sizeOrCapacity: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Need suggestion" />
                </SelectTrigger>
                <SelectContent>
                  {sizeOpts.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="mt-2"
                value={sizeIsStandard ? "" : item.sizeOrCapacity}
                onChange={(e) =>
                  onChange({ sizeOrCapacity: e.target.value })
                }
                placeholder="…or type a custom size"
              />
            </>
          ) : (
            <Input
              value={item.sizeOrCapacity}
              onChange={(e) =>
                onChange({ sizeOrCapacity: e.target.value })
              }
              placeholder="e.g., 6x4 ft, 3-door, single bed"
            />
          )}
        </Field>
        <Field label="Material">
          <Select
            value={item.material}
            onValueChange={(v) => onChange({ material: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Need suggestion" />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {labelForMaterial(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Budget" className="sm:col-span-2">
          <Select
            value={item.budgetRange}
            onValueChange={(v) => onChange({ budgetRange: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_OPTIONS.map((b) => (
                <SelectItem key={b} value={b}>
                  {labelForBudget(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {item.upload ? (
          <button
            type="button"
            onClick={() => onChange({ upload: undefined })}
            className="text-xs text-slate-500 hover:text-rose-500"
          >
            Remove photo
          </button>
        ) : (
          <span />
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-rose-500 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onDone}
            className="bg-[#2c3e50] text-white hover:bg-[#1f2d3d]"
          >
            <Check className="h-4 w-4" /> Done
          </Button>
        </div>
      </div>
    </li>
  );
};

const SkeletonOverlay = () => (
  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/85 backdrop-blur-sm">
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 rounded-full border-4 border-[#2c3e50]/15" />
      <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#2c3e50]" />
    </div>
    <p className="text-sm font-medium text-slate-600">
      Delivering to our team…
    </p>
  </div>
);

const SuccessView = ({
  name,
  category,
  onClose,
}: {
  name: string;
  category: string;
  onClose: () => void;
}) => {
  const dots = useMemo(() => Array.from({ length: 18 }), []);
  return (
    <div className="relative flex flex-col items-center px-6 py-10 text-center sm:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {dots.map((_, i) => {
          const left = (i * 53) % 100;
          const delay = (i % 6) * 120;
          const colors = [
            "bg-[#2c3e50]",
            "bg-amber-400",
            "bg-emerald-500",
            "bg-rose-400",
          ];
          const color = colors[i % colors.length];
          return (
            <span
              key={i}
              className={cn(
                "absolute top-0 h-2 w-2 rounded-full opacity-0",
                color,
              )}
              style={{
                left: `${left}%`,
                animation: `enquiry-fall 1600ms ${delay}ms ease-out forwards`,
              }}
            />
          );
        })}
        <style>{`
          @keyframes enquiry-fall {
            0% { transform: translateY(-20px) scale(0.6); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translateY(280px) rotate(360deg); opacity: 0; }
          }
          @keyframes enquiry-check {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>

      <div
        className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg"
        style={{ animation: "enquiry-check 600ms ease-out" }}
      >
        <Check className="h-10 w-10 text-white" strokeWidth={3} />
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-400/40" />
      </div>

      <h3 className="font-display text-2xl text-[#2c3e50]">
        Request Received
      </h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
        Thank you{" "}
        <span className="font-semibold text-[#2c3e50]">
          {name || "there"}
        </span>
        ! Your{" "}
        <span className="font-semibold text-[#2c3e50]">{category}</span>{" "}
        request has been securely received. Our team will review it shortly
        and reach you on WhatsApp.
      </p>

      <Button
        onClick={onClose}
        size="lg"
        className="mt-6 bg-[#2c3e50] text-white hover:bg-[#1f2d3d] sm:min-w-[180px]"
      >
        <MessageCircle className="h-4 w-4" /> Close
      </Button>
    </div>
  );
};

const buildSummaryMessage = (
  category: Category,
  details: Record<string, unknown>,
  items: Array<{
    productName?: string | null;
    itemType: string;
    quantity: number;
    sizeOrCapacity: string;
    material: string;
    budgetRange: string;
  }>,
  shortNote?: string,
): string => {
  const lines: string[] = [`Category: ${category}`];
  if (items.length > 0) {
    lines.push("", "Items:");
    items.forEach((it, idx) => {
      const name = it.productName || it.itemType || "Item";
      lines.push(
        `${idx + 1}. ${name} x${it.quantity} - ${it.sizeOrCapacity} - ${labelForMaterial(it.material)} - ${labelForBudget(it.budgetRange)}`,
      );
    });
  }
  if (shortNote && shortNote.trim()) {
    lines.push("", `Note: ${shortNote.trim()}`);
  }
  const walk = (obj: unknown, prefix = "") => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        if (typeof v[0] === "object" && v[0] && "name" in (v[0] as object)) {
          lines.push(
            `${prefix}${k}: ${(v as { name: string }[])
              .map((f) => f.name)
              .join(", ")}`,
          );
        } else {
          lines.push(`${prefix}${k}: ${v.join(", ")}`);
        }
      } else if (typeof v === "object" && v !== null) {
        walk(v, `${prefix}${k}.`);
      } else if (v !== "" && v != null) {
        lines.push(`${prefix}${k}: ${v}`);
      }
    }
  };
  walk(details);
  return lines.join("\n");
};

export default EnquiryForm;
