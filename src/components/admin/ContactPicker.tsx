import { Button } from "@/components/ui/button";
import { BookUser } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

type ContactInfo = { name?: string; tel?: string; place?: string; address?: string };

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

// Heuristic: pick the most likely "city/town" token from a free-form address.
// Strategy:
//  1) Split by commas/newlines; trim.
//  2) Skip pure pincodes / state names / country tokens.
//  3) Prefer the second-to-last meaningful token (typical Indian format:
//     "House, Street, Town, District, State, PIN" — town/district sit in the
//     middle, state + pin at the end). Fall back to the last text token.
const STATE_OR_COUNTRY = new Set(
  [
    "india", "bharat",
    "kerala", "tamil nadu", "tamilnadu", "karnataka", "andhra pradesh", "telangana",
    "maharashtra", "gujarat", "rajasthan", "punjab", "haryana", "delhi", "goa",
    "uttar pradesh", "madhya pradesh", "bihar", "west bengal", "odisha", "assam",
    "jharkhand", "chhattisgarh", "uttarakhand", "himachal pradesh",
    "jammu and kashmir", "ladakh", "manipur", "meghalaya", "mizoram", "nagaland",
    "sikkim", "tripura", "arunachal pradesh",
  ].map((s) => s.toLowerCase()),
);
const isPincode = (t: string) => /^\d{5,6}$/.test(t.replace(/\s/g, ""));
const isStateOrCountry = (t: string) => STATE_OR_COUNTRY.has(t.toLowerCase());

const extractPlaceFromAddress = (raw: string): string => {
  if (!raw) return "";
  const tokens = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    // Drop pincodes and obvious state/country lines
    .filter((t) => !isPincode(t) && !isStateOrCountry(t));
  if (tokens.length === 0) return "";
  // Prefer second-to-last (typical "town" position), else last.
  const candidate = tokens.length >= 2 ? tokens[tokens.length - 2] : tokens[tokens.length - 1];
  // Strip trailing pincode glued to a town like "Kalpetta 673121"
  return candidate.replace(/\s*\b\d{5,6}\b\s*$/, "").trim();
};

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
    projection: { name: true, phones: true, postalAddresses: true },
  });

  const c = res?.contact;
  if (!c) return null;

  const name =
    c?.name?.display ||
    [c?.name?.given, c?.name?.family].filter(Boolean).join(" ").trim() ||
    "";
  const tel = Array.isArray(c?.phones) && c.phones.length > 0 ? String(c.phones[0]?.number ?? "") : "";

  // Address: capacitor-community/contacts returns objects like
  // { street, neighborhood, city, region, postcode, country, ... } or formatted string.
  let address = "";
  let place = "";
  if (Array.isArray(c?.postalAddresses) && c.postalAddresses.length > 0) {
    const a = c.postalAddresses[0] || {};
    place =
      String(a.city || a.neighborhood || a.subLocality || a.locality || "").trim();
    const parts = [a.street, a.neighborhood, a.city, a.region, a.postcode, a.country]
      .map((x: any) => (x ? String(x).trim() : ""))
      .filter(Boolean);
    address = a.formatted ? String(a.formatted).trim() : parts.join(", ");
    if (!place && address) place = extractPlaceFromAddress(address);
  }

  return { name: name.trim(), tel: cleanTel(tel), place, address };
};

// Web (Chrome/Edge on Android over HTTPS) ------------------------------------
const pickWeb = async (): Promise<ContactInfo | null> => {
  // Try to also request "address" — supported on newer Chrome on Android.
  // Fall back gracefully if the browser rejects unknown properties.
  const nav = navigator as any;
  let contacts: any[] = [];
  try {
    contacts = await nav.contacts.select(["name", "tel", "address"], { multiple: false });
  } catch {
    contacts = await nav.contacts.select(["name", "tel"], { multiple: false });
  }
  if (!contacts || contacts.length === 0) return null;
  const c = contacts[0];
  const name = Array.isArray(c.name) && c.name.length > 0 ? String(c.name[0]) : "";
  const tel = Array.isArray(c.tel) && c.tel.length > 0 ? String(c.tel[0]) : "";

  // address[0] is a ContactAddress { city, region, postalCode, country, addressLine: string[] }
  let address = "";
  let place = "";
  if (Array.isArray(c.address) && c.address.length > 0) {
    const a = c.address[0] || {};
    place = String(a.city || a.dependentLocality || "").trim();
    const lines = Array.isArray(a.addressLine) ? a.addressLine.filter(Boolean) : [];
    const parts = [...lines, a.city, a.region, a.postalCode, a.country]
      .map((x: any) => (x ? String(x).trim() : ""))
      .filter(Boolean);
    address = parts.join(", ");
    if (!place && address) place = extractPlaceFromAddress(address);
  }

  return { name: name.trim(), tel: cleanTel(tel), place, address };
};

export const ContactPicker = ({ onPick, className, label = "From Contacts" }: Props) => {
  const native = isNative();
  const webOk = isWebContactsSupported();
  const supported = native || webOk;

  const handlePick = async () => {
    if (!supported) {
      toast({
        title: "Contacts not available here",
        description:
          "Open this app on your phone (installed app or Chrome on Android) to pick from your saved contacts.",
      });
      return;
    }
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
