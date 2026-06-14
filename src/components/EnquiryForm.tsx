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
} from "lucide-react";
import { registerEnquiryOpener, ENQUIRY_ENDPOINT } from "@/lib/enquiryForm";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  base64: string; // data URL
}

interface CommonState {
  customerName: string;
  phone: string;
  location: string;
}

const NATURE_OPTIONS: { value: Exclude<Category, "">; ml: string }[] = [
  { value: "New Purchase", ml: "പുതിയ ഫർണിച്ചർ വാങ്ങാൻ" },
  { value: "Custom Design", ml: "കസ്റ്റം ഡിസൈൻ ഓർഡറുകൾ" },
  { value: "Complaint & Replacement", ml: "പരാതികളും റീപ്ലേസ്‌മെന്റും" },
  { value: "Service & Repair", ml: "സർവീസ് ആവശ്യങ്ങൾ" },
  { value: "Delivery & Installation", ml: "ഡെലിവറി & ഫിറ്റിംഗ്" },
  { value: "General Inquiry", ml: "മറ്റു വിവരങ്ങൾ" },
];

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB per file — keeps Apps Script payload small

// ---------- Component ----------
export const EnquiryForm = () => {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState<string | undefined>(undefined);
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [productImage, setProductImage] = useState<string | undefined>(undefined);
  const [productCode, setProductCode] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<Status>("idle");

  // Common fields
  const [common, setCommon] = useState<CommonState>({
    customerName: "",
    phone: "",
    location: "",
  });
  const [category, setCategory] = useState<Category>("");

  // Section-specific state (kept independent so resets are targeted)
  const [purchase, setPurchase] = useState({
    item: "",
    itemOther: "",
    material: "",
    materialOther: "",
    sizeCapacity: "",
    budget: "",
    budgetAmount: "",
  });
  const [custom, setCustom] = useState({
    workType: "",
    workTypeOther: "",
    dimensions: "",
    fabricColor: "",
    refImages: [] as UploadedFile[],
  });
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

  // Open hooks
  useEffect(() => {
    registerEnquiryOpener(({ productName: p, productId: pid } = {}) => {
      setProductName(p);
      setProductId(pid);
      setProductImage(undefined);
      setProductCode(undefined);
      setStatus("idle");
      setOpen(true);
    });
    return () => registerEnquiryOpener(null);
  }, []);

  // Pull cover image + code for the catalog model so admin can identify it.
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("product_code, product_images(image_url, display_order)")
        .eq("id", productId)
        .maybeSingle();
      if (cancelled || !data) return;
      setProductCode(data.product_code ?? undefined);
      const imgs = (data.product_images ?? []).slice().sort(
        (a: { display_order: number }, b: { display_order: number }) =>
          a.display_order - b.display_order,
      );
      setProductImage(imgs[0]?.image_url);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Deep-link: WhatsApp / external sites can share
  //   https://hitechfurniture-online.lovable.app/?enquiry=1
  // (optionally &product=Sofa%20Name). Auto-opens the form on load.
  const handledDeepLink = useRef(false);
  useEffect(() => {
    if (handledDeepLink.current) return;
    handledDeepLink.current = true;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("enquiry") === "1" || params.get("enquiry") === "true") {
      const prod = params.get("product") || undefined;
      setTimeout(() => {
        setProductName(prod);
        setStatus("idle");
        setOpen(true);
      }, 300);
    }
  }, []);

  const resetAll = () => {
    setCommon({ customerName: "", phone: "", location: "" });
    setCategory("");
    resetSections();
    setProductName(undefined);
    setProductId(undefined);
    setProductImage(undefined);
    setProductCode(undefined);
    setStatus("idle");
  };

  const resetSections = () => {
    setPurchase({ item: "", itemOther: "", material: "", materialOther: "", sizeCapacity: "", budget: "", budgetAmount: "" });
    setCustom({ workType: "", workTypeOther: "", dimensions: "", fabricColor: "", refImages: [] });
    setComplaint({
      invoiceNumber: "",
      purchaseDate: "",
      issueType: "",
      issueTypeOther: "",
      description: "",
      proofFiles: [],
    });
    setService({ billNumber: "", serviceType: "", serviceTypeOther: "", condition: "", preferredDate: "" });
    setDelivery({ orderId: "", address: "", mapLink: "", assembly: "", floor: "", floorOther: "" });
    setGeneral({ subject: "", message: "" });
  };

  const handleCategoryChange = (v: string) => {
    setCategory(v as Category);
    resetSections(); // user changed dropdown → clear all hidden fields
  };

  const handleOpenChange = (v: boolean) => {
    if (status === "submitting") return;
    setOpen(v);
    if (!v) setTimeout(resetAll, 200);
  };

  // ---------- Validation ----------
  const validate = (): string | null => {
    if (!common.customerName.trim()) return "Please enter your name.";
    if (!common.phone.trim()) return "Please enter your phone number.";
    if (!common.location.trim()) return "Please enter your location.";
    if (!category) return "Please select what we can help you with.";
    switch (category) {
      case "Complaint & Replacement":
        if (!complaint.invoiceNumber.trim()) return "Invoice / Bill number is required.";
        if (!complaint.description.trim()) return "Please describe the issue.";
        if (complaint.proofFiles.length === 0)
          return "Please upload at least one photo/video of the damage.";
        break;
      case "Delivery & Installation":
        if (!delivery.orderId.trim()) return "Order ID / Invoice number is required.";
        if (!delivery.address.trim()) return "Delivery address is required.";
        break;
      case "General Inquiry":
        if (!general.message.trim()) return "Please write your message.";
        break;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setStatus("submitting");

    // Single structured object — categorized so it's easy to route in Apps Script / Firebase
    const details: Record<string, unknown> = {};
    switch (category) {
      case "New Purchase":
        details.newPurchase = purchase;
        break;
      case "Custom Design":
        details.customDesign = custom;
        break;
      case "Complaint & Replacement":
        details.complaint = complaint;
        break;
      case "Service & Repair":
        details.service = service;
        break;
      case "Delivery & Installation":
        details.delivery = delivery;
        break;
      case "General Inquiry":
        details.general = general;
        break;
    }

    const payload = {
      // Backwards-compatible fields the existing Apps Script reads
      customerName: common.customerName.trim(),
      phone: common.phone.trim(),
      whatsapp: common.phone.trim(),
      location: common.location.trim(),
      enquiryType: category,
      productName: productName ?? category,
      message: buildSummaryMessage(category, details),
      // New structured payload for upgraded backends
      category,
      details,
      productId,
      productCode,
      productImage,
      submittedAt: new Date().toISOString(),
      source: typeof window !== "undefined" ? window.location.href : "",
    };

    try {
      // Fire-and-forget to legacy Apps Script + create lead in our database in parallel.
      const summary = buildSummaryMessage(category, details);
      await Promise.allSettled([
        fetch(ENQUIRY_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        }),
        supabase.functions.invoke("create-enquiry-lead", {
          body: {
            customerName: common.customerName.trim(),
            phone: common.phone.trim(),
            location: common.location.trim(),
            category,
            summary,
            productId,
            productName,
            productImage,
            productCode,
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

  const canSubmit = !!category;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-xl">
        {status === "success" ? (
          <SuccessView
            name={common.customerName}
            category={category || "Enquiry"}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <>
            {/* Premium charcoal header */}
            <div className="bg-[#2c3e50] px-6 py-7 text-white sm:px-8 sm:py-8">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
                HitecH Furniture
              </p>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-white sm:text-[28px]">
                  Smart Inquiry &amp; Support
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm text-white/75">
                  Tell us what you need — we&apos;ll respond on WhatsApp shortly.
                </DialogDescription>
              </DialogHeader>
              {productName && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur">
                  <Sparkles className="h-3 w-3" />
                  Enquiring about: <span className="font-semibold">{productName}</span>
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="relative space-y-6 px-6 pb-6 pt-6 sm:px-8 sm:pb-8"
            >
              {/* Section 0 — Basic */}
              <SectionHeading title="Your Details" subtitle="അടിസ്ഥാന വിവരങ്ങൾ" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Customer Name"
                  ml="പേര്"
                  required
                  className="sm:col-span-2"
                >
                  <Input
                    value={common.customerName}
                    onChange={(e) =>
                      setCommon((s) => ({ ...s, customerName: e.target.value }))
                    }
                    maxLength={100}
                    placeholder="Your full name"
                    required
                  />
                </Field>
                <Field label="Phone Number" ml="ഫോൺ നമ്പർ" required>
                  <Input
                    type="tel"
                    value={common.phone}
                    onChange={(e) =>
                      setCommon((s) => ({ ...s, phone: e.target.value }))
                    }
                    maxLength={20}
                    placeholder="+91 …"
                    required
                  />
                </Field>
                <Field label="Place / Location" ml="സ്ഥലം" required>
                  <Input
                    value={common.location}
                    onChange={(e) =>
                      setCommon((s) => ({ ...s, location: e.target.value }))
                    }
                    maxLength={120}
                    placeholder="City / Town"
                    required
                  />
                </Field>
              </div>

              {/* Main dropdown */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <Field
                  label="What can we help you with today?"
                  ml="നിങ്ങളുടെ ആവശ്യം തിരഞ്ഞെടുക്കുക"
                  required
                >
                  <Select value={category} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="bg-background">
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
              </div>

              {/* Conditional sections */}
              {category === "New Purchase" && (
                <ConditionalBlock title="New Purchase" ml="പുതിയ ഫർണിച്ചർ വാങ്ങാൻ">
                  <Field label="Furniture Item Needed">
                    <Select
                      value={purchase.item}
                      onValueChange={(v) => setPurchase((s) => ({ ...s, item: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose item…" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "Sofa",
                          "Cot",
                          "Dining Table",
                          "Wardrobe",
                          "Office Chair",
                          "Almirah",
                          "Others",
                        ].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {purchase.item === "Others" && (
                      <Input
                        className="mt-2"
                        value={purchase.itemOther}
                        onChange={(e) =>
                          setPurchase((s) => ({ ...s, itemOther: e.target.value }))
                        }
                        placeholder="Please specify the item you need"
                      />
                    )}
                  </Field>
                  <Field label="Material Preference">
                    <Select
                      value={purchase.material}
                      onValueChange={(v) => setPurchase((s) => ({ ...s, material: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose material…" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "Teak Wood",
                          "Premium Mahogany",
                          "High-Quality MDF",
                          "Multiwood",
                          "Other Wood",
                          "Others",
                        ].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(purchase.material === "Other Wood" || purchase.material === "Others") && (
                      <Input
                        className="mt-2"
                        value={purchase.materialOther}
                        onChange={(e) =>
                          setPurchase((s) => ({ ...s, materialOther: e.target.value }))
                        }
                        placeholder={
                          purchase.material === "Other Wood"
                            ? "Enter wood name (e.g., Rosewood, Mango Wood)"
                            : "Please specify the material"
                        }
                      />
                    )}
                  </Field>
                  <Field label="Seating / Size Capacity">
                    <Input
                      value={purchase.sizeCapacity}
                      onChange={(e) =>
                        setPurchase((s) => ({ ...s, sizeCapacity: e.target.value }))
                      }
                      placeholder="e.g., 3+1+1 Sofa, 6 Seater Table, 5x6 Ft Cot"
                    />
                  </Field>
                  <Field label="Budget Range">
                    <Select
                      value={purchase.budget}
                      onValueChange={(v) => setPurchase((s) => ({ ...s, budget: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose budget…" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Budget Friendly", "Mid-Range", "Premium Wood", "Others"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(purchase.budget === "Budget Friendly" || purchase.budget === "Others") && (
                      <Input
                        className="mt-2"
                        type="text"
                        inputMode="numeric"
                        value={purchase.budgetAmount}
                        onChange={(e) =>
                          setPurchase((s) => ({ ...s, budgetAmount: e.target.value }))
                        }
                        placeholder={
                          purchase.budget === "Budget Friendly"
                            ? "Enter your approx. budget in ₹ (e.g., 15000)"
                            : "Please specify your budget"
                        }
                      />
                    )}
                  </Field>
                </ConditionalBlock>
              )}

              {category === "Custom Design" && (
                <ConditionalBlock title="Custom Design" ml="കസ്റ്റം ഡിസൈൻ ഓർഡറുകൾ">
                  <Field label="Type of Custom Work">
                    <Select
                      value={custom.workType}
                      onValueChange={(v) => setCustom((s) => ({ ...s, workType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose…" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "Modular Kitchen",
                          "Full Bedroom Set",
                          "Custom Living Room Unit",
                          "TV Unit",
                        ].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Specific Dimensions / Requirements">
                    <Textarea
                      rows={3}
                      value={custom.dimensions}
                      onChange={(e) =>
                        setCustom((s) => ({ ...s, dimensions: e.target.value }))
                      }
                      placeholder="Describe room size or specific furniture dimensions…"
                    />
                  </Field>
                  <Field label="Fabric & Color Preference">
                    <Input
                      value={custom.fabricColor}
                      onChange={(e) =>
                        setCustom((s) => ({ ...s, fabricColor: e.target.value }))
                      }
                      placeholder="e.g., Deep Blue Velvet, Matte Black Polish, Jute Fabric"
                    />
                  </Field>
                  <FileField
                    label="Upload Reference Design"
                    accept="image/*"
                    multiple
                    files={custom.refImages}
                    onChange={(files) => setCustom((s) => ({ ...s, refImages: files }))}
                  />
                </ConditionalBlock>
              )}

              {category === "Complaint & Replacement" && (
                <ConditionalBlock title="Complaint & Replacement" ml="പരാതികളും റീപ്ലേസ്‌മെന്റും">
                  <Field label="Invoice / Bill Number" required>
                    <Input
                      value={complaint.invoiceNumber}
                      onChange={(e) =>
                        setComplaint((s) => ({ ...s, invoiceNumber: e.target.value }))
                      }
                      placeholder="Bill #"
                      required
                    />
                  </Field>
                  <Field label="Date of Purchase">
                    <Input
                      type="date"
                      value={complaint.purchaseDate}
                      onChange={(e) =>
                        setComplaint((s) => ({ ...s, purchaseDate: e.target.value }))
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
                        ].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Detailed Description of Issue" required>
                    <Textarea
                      rows={3}
                      value={complaint.description}
                      onChange={(e) =>
                        setComplaint((s) => ({ ...s, description: e.target.value }))
                      }
                      placeholder="Describe what happened…"
                      required
                    />
                  </Field>
                  <FileField
                    label="Upload Proof of Damage"
                    helper="Photo/video upload is mandatory for verification."
                    accept="image/*,video/*"
                    multiple
                    required
                    files={complaint.proofFiles}
                    onChange={(files) =>
                      setComplaint((s) => ({ ...s, proofFiles: files }))
                    }
                  />
                </ConditionalBlock>
              )}

              {category === "Service & Repair" && (
                <ConditionalBlock title="Service & Repair" ml="സർവീസ് ആവശ്യങ്ങൾ">
                  <Field label="Original Bill Number (if available)">
                    <Input
                      value={service.billNumber}
                      onChange={(e) =>
                        setService((s) => ({ ...s, billNumber: e.target.value }))
                      }
                      placeholder="Bill #"
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
                        ].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Current Furniture Condition">
                    <Textarea
                      rows={3}
                      value={service.condition}
                      onChange={(e) =>
                        setService((s) => ({ ...s, condition: e.target.value }))
                      }
                      placeholder="Describe the current state of the item…"
                    />
                  </Field>
                  <Field label="Preferred Service Date">
                    <Input
                      type="date"
                      value={service.preferredDate}
                      onChange={(e) =>
                        setService((s) => ({ ...s, preferredDate: e.target.value }))
                      }
                    />
                  </Field>
                </ConditionalBlock>
              )}

              {category === "Delivery & Installation" && (
                <ConditionalBlock title="Delivery & Installation" ml="ഡെലിവറി & ഫിറ്റിംഗ്">
                  <Field label="Order ID / Invoice Number" required>
                    <Input
                      value={delivery.orderId}
                      onChange={(e) =>
                        setDelivery((s) => ({ ...s, orderId: e.target.value }))
                      }
                      placeholder="Order / Invoice #"
                      required
                    />
                  </Field>
                  <Field label="Exact Delivery Address" required>
                    <Textarea
                      rows={3}
                      value={delivery.address}
                      onChange={(e) =>
                        setDelivery((s) => ({ ...s, address: e.target.value }))
                      }
                      placeholder="Full address with landmarks…"
                      required
                    />
                  </Field>
                  <Field label="Google Map Link or Landmark">
                    <Input
                      value={delivery.mapLink}
                      onChange={(e) =>
                        setDelivery((s) => ({ ...s, mapLink: e.target.value }))
                      }
                      placeholder="https://maps.app.goo.gl/…"
                    />
                  </Field>
                  <Field label="Is Carpenter Assembly Required?">
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
                        <SelectItem value="No">No (ഞങ്ങൾ ചെയ്തോളാം)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Floor Details">
                    <Select
                      value={delivery.floor}
                      onValueChange={(v) => setDelivery((s) => ({ ...s, floor: v }))}
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
                        ].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </ConditionalBlock>
              )}

              {category === "General Inquiry" && (
                <ConditionalBlock title="General Inquiry" ml="മറ്റു വിവരങ്ങൾ">
                  <Field label="Subject">
                    <Input
                      value={general.subject}
                      onChange={(e) =>
                        setGeneral((s) => ({ ...s, subject: e.target.value }))
                      }
                      placeholder="e.g., Showroom Location, Working Hours, Current Offers"
                    />
                  </Field>
                  <Field label="Your Message" required>
                    <Textarea
                      rows={4}
                      value={general.message}
                      onChange={(e) =>
                        setGeneral((s) => ({ ...s, message: e.target.value }))
                      }
                      placeholder="How can we help?"
                      required
                    />
                  </Field>
                </ConditionalBlock>
              )}

              {canSubmit && (
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-[#2c3e50] text-white shadow-md transition hover:bg-[#1f2d3d]"
                  disabled={status === "submitting"}
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Submitting securely…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" /> Submit Request
                    </>
                  )}
                </Button>
              )}

              {status === "submitting" && <SkeletonOverlay />}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ---------- Small subcomponents ----------

const SectionHeading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="border-l-2 border-[#2c3e50] pl-3">
    <p className="font-display text-lg font-semibold text-[#2c3e50]">{title}</p>
    {subtitle && (
      <p className="text-xs font-medium tracking-wide text-slate-500">{subtitle}</p>
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
      {ml && <span className="text-[11px] font-normal text-slate-400">({ml})</span>}
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
  required,
  files,
  onChange,
}: {
  label: string;
  helper?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const accepted: UploadedFile[] = [];
    for (const f of incoming) {
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
    <Field
      label={label}
      required={required}
    >
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 text-center transition hover:border-[#2c3e50]/40 hover:bg-slate-50 cursor-pointer"
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
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
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

const SkeletonOverlay = () => (
  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/85 backdrop-blur-sm">
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 rounded-full border-4 border-[#2c3e50]/15" />
      <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#2c3e50]" />
    </div>
    <p className="text-sm font-medium text-slate-600">Delivering to our team…</p>
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
              className={cn("absolute top-0 h-2 w-2 rounded-full opacity-0", color)}
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

      <h3 className="font-display text-2xl text-[#2c3e50]">Request Received</h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
        Thank you{" "}
        <span className="font-semibold text-[#2c3e50]">{name || "there"}</span>! Your{" "}
        <span className="font-semibold text-[#2c3e50]">{category}</span> request has
        been securely received. Our team will review it shortly and reach you on
        WhatsApp.
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

// ---------- Helpers ----------

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const buildSummaryMessage = (
  category: Category,
  details: Record<string, unknown>,
): string => {
  // Flatten into a human-readable string so existing Apps Script (which
  // writes a `message` column) still surfaces the new structured fields.
  const lines: string[] = [`Category: ${category}`];
  const walk = (obj: unknown, prefix = "") => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        // For file arrays, just list names
        if (typeof v[0] === "object" && v[0] && "name" in (v[0] as object)) {
          lines.push(
            `${prefix}${k}: ${(v as { name: string }[]).map((f) => f.name).join(", ")}`,
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