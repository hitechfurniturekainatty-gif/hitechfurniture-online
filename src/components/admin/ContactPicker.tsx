import { Button } from "@/components/ui/button";
import { BookUser } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

type ContactInfo = { name?: string; tel?: string };

type Props = {
  onPick: (contact: ContactInfo) => void;
  className?: string;
  label?: string;
};

const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const isWebContactsSupported = () =>
  typeof navigator !== "undefined" &&
  "contacts" in navigator &&
  // @ts-expect-error - experimental API
  typeof navigator.contacts?.select === "function";

const cleanTel = (t: string) => t.replace(/\s+/g, "").trim();

// Native (iOS + Android via Capacitor) ----------------------------------------
const pickNative = async (): Promise<ContactInfo | null> => {
  // Lazy import so web build doesn't try to resolve native code paths
  const { Contacts } = await import("@capacitor-community/contacts");

  const perm = await Contacts.requestPermissions();
  if (perm.contacts !== "granted") {
    toast({
      title: "Permission needed",
      description: "Allow Contacts access in your phone settings to use this.",
      variant: "destructive",
    });
    return null;
  }

  // Pick a single contact via the native picker (iOS + Android)
  const res = await (Contacts as any).pickContact({
    projection: { name: true, phones: true },
  });

  const c = res?.contact;
  if (!c) return null;

  const name =
    c?.name?.display ||
    [c?.name?.given, c?.name?.family].filter(Boolean).join(" ").trim() ||
    "";
  const tel = Array.isArray(c?.phones) && c.phones.length > 0 ? String(c.phones[0]?.number ?? "") : "";
  return { name: name.trim(), tel: cleanTel(tel) };
};

// Web (Chrome/Edge on Android over HTTPS) ------------------------------------
const pickWeb = async (): Promise<ContactInfo | null> => {
  // @ts-expect-error - experimental API
  const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
  if (!contacts || contacts.length === 0) return null;
  const c = contacts[0];
  const name = Array.isArray(c.name) && c.name.length > 0 ? String(c.name[0]) : "";
  const tel = Array.isArray(c.tel) && c.tel.length > 0 ? String(c.tel[0]) : "";
  return { name: name.trim(), tel: cleanTel(tel) };
};

export const ContactPicker = ({ onPick, className, label = "From Contacts" }: Props) => {
  const native = isNative();
  const webOk = isWebContactsSupported();
  const supported = native || webOk;

  if (!supported) return null;

  const handlePick = async () => {
    try {
      const result = native ? await pickNative() : await pickWeb();
      if (!result) return;
      onPick(result);
      toast({ title: "Contact added", description: result.name || result.tel || "Filled from contacts" });
    } catch (err: any) {
      const name = err?.name ?? "";
      // Silent on user-cancelled / denied
      if (name === "AbortError" || name === "NotAllowedError") return;
      const msg = err?.message || String(err);
      if (/cancel/i.test(msg)) return;
      toast({ title: "Couldn't open contacts", description: msg, variant: "destructive" });
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={handlePick}>
      <BookUser className="mr-1.5 h-4 w-4" /> {label}
    </Button>
  );
};
