import { Button } from "@/components/ui/button";
import { BookUser } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ContactInfo = { name?: string; tel?: string };

type Props = {
  onPick: (contact: ContactInfo) => void;
  className?: string;
  label?: string;
};

// Web Contact Picker API: Chrome / Edge on Android (HTTPS only).
// Gracefully degrades on unsupported browsers (iOS Safari, desktop).
export const ContactPicker = ({ onPick, className, label = "Pick from Contacts" }: Props) => {
  const supported =
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    // @ts-expect-error - experimental API
    typeof navigator.contacts?.select === "function";

  if (!supported) return null;

  const handlePick = async () => {
    try {
      // @ts-expect-error - experimental API
      const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
      if (!contacts || contacts.length === 0) return;
      const c = contacts[0];
      const name = Array.isArray(c.name) && c.name.length > 0 ? String(c.name[0]) : "";
      const tel = Array.isArray(c.tel) && c.tel.length > 0 ? String(c.tel[0]) : "";
      onPick({ name: name.trim(), tel: tel.replace(/\s+/g, "").trim() });
      toast({ title: "Contact added", description: name || tel || "Filled from contacts" });
    } catch (err: any) {
      // User cancelled or permission denied — silent unless real error
      if (err?.name && err.name !== "AbortError" && err.name !== "NotAllowedError") {
        toast({ title: "Couldn't open contacts", description: err.message ?? String(err), variant: "destructive" });
      }
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={handlePick}>
      <BookUser className="mr-1.5 h-4 w-4" /> {label}
    </Button>
  );
};
