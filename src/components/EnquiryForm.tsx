import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Check, Sparkles, MessageCircle } from "lucide-react";
import { registerEnquiryOpener, ENQUIRY_ENDPOINT } from "@/lib/enquiryForm";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type EnquiryType = "" | "Purchase" | "Service" | "Complaint";

type Status = "idle" | "submitting" | "success";

export const EnquiryForm = () => {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<Status>("idle");

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [location, setLocation] = useState("");
  const [enquiryType, setEnquiryType] = useState<EnquiryType>("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    registerEnquiryOpener(({ productName: p } = {}) => {
      setProductName(p);
      setStatus("idle");
      setOpen(true);
    });
    return () => registerEnquiryOpener(null);
  }, []);

  // Keep whatsapp in sync when checkbox is on.
  useEffect(() => {
    if (sameAsPhone) setWhatsapp(phone);
  }, [sameAsPhone, phone]);

  const reset = () => {
    setCustomerName("");
    setPhone("");
    setWhatsapp("");
    setSameAsPhone(true);
    setLocation("");
    setEnquiryType("");
    setMessage("");
    setProductName(undefined);
    setStatus("idle");
  };

  const handleOpenChange = (v: boolean) => {
    if (status === "submitting") return; // lock during submit
    setOpen(v);
    if (!v) setTimeout(reset, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !enquiryType) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }
    setStatus("submitting");
    const payload = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      whatsapp: (sameAsPhone ? phone : whatsapp).trim(),
      location: location.trim(),
      enquiryType,
      productName: productName ?? "General Enquiry",
      message: message.trim(),
    };
    try {
      // Google Apps Script accepts no-cors text/plain — avoids CORS preflight failure.
      await fetch(ENQUIRY_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
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

  const isProductLocked = !!productName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {status === "success" ? (
          <SuccessView onClose={() => handleOpenChange(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {isProductLocked ? "Product Enquiry" : "General Enquiry"}
              </DialogTitle>
              <DialogDescription>
                Share a few details and our team will reach you on WhatsApp shortly.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              {/* Section 1: Contact */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Contact Information
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="enq-name">
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="enq-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your full name"
                    required
                    maxLength={100}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="enq-phone">
                      Phone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="enq-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 ..."
                      required
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="enq-loc">Location / City</Label>
                    <Input
                      id="enq-loc"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City"
                      maxLength={80}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enq-wa">WhatsApp Number</Label>
                  <Input
                    id="enq-wa"
                    type="tel"
                    value={sameAsPhone ? phone : whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    disabled={sameAsPhone}
                    placeholder="+91 ..."
                    maxLength={20}
                  />
                  <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-muted-foreground">
                    <Checkbox
                      checked={sameAsPhone}
                      onCheckedChange={(v) => setSameAsPhone(!!v)}
                    />
                    Same as Phone Number
                  </label>
                </div>
              </div>

              {/* Section 2: Enquiry */}
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  Enquiry Details
                </p>
                <div className="space-y-1.5">
                  <Label>
                    Enquiry Type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={enquiryType} onValueChange={(v) => setEnquiryType(v as EnquiryType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Purchase">Purchase</SelectItem>
                      <SelectItem value="Service">Service</SelectItem>
                      <SelectItem value="Complaint">Complaint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isProductLocked && (
                  <div className="space-y-1.5">
                    <Label htmlFor="enq-prod">Product Name</Label>
                    <Input id="enq-prod" value={productName ?? ""} readOnly className="bg-muted" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="enq-msg">Message / Special Requirements</Label>
                  <Textarea
                    id="enq-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us more (optional)"
                    rows={4}
                    maxLength={1000}
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Sending your enquiry…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" /> Submit Enquiry
                  </>
                )}
              </Button>
            </form>

            {status === "submitting" && <SkeletonOverlay />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Premium loading veil that sits over the form during submit.
const SkeletonOverlay = () => (
  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/85 backdrop-blur-sm">
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
      <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
    </div>
    <p className="text-sm font-medium text-foreground/80">Delivering to our team…</p>
  </div>
);

const SuccessView = ({ onClose }: { onClose: () => void }) => {
  // Confetti-ish floating dots (CSS only — no extra deps).
  const dots = Array.from({ length: 18 });
  return (
    <div className="relative flex flex-col items-center px-2 py-6 text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {dots.map((_, i) => {
          const left = (i * 53) % 100;
          const delay = (i % 6) * 120;
          const colors = ["bg-primary", "bg-accent", "bg-emerald-500", "bg-amber-400"];
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

      <h3 className="font-display text-2xl text-foreground">Enquiry Received</h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Thank you for choosing <span className="font-semibold text-foreground">HitecH Furniture and
        Interiors</span>! Our dedicated enquiry team will review your request and get in touch with
        you via WhatsApp as soon as possible to assist you.
      </p>

      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={onClose} variant="default" size="lg" className="sm:min-w-[160px]">
          <MessageCircle className="h-4 w-4" /> Close
        </Button>
      </div>
    </div>
  );
};

export default EnquiryForm;