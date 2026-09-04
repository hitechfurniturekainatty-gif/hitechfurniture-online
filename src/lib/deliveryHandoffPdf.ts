import { jsPDF } from "jspdf";
import { COMPANY } from "@/lib/companyInfo";
import { firstUrl } from "@/lib/firstUrl";

export type DeliveryPdfItem = {
  description: string;
  quantity: number;
  measurement?: string | null;
  catalog_text?: string | null;
  item_image_url?: string | null;
  catalog_image_url?: string | null;
  measurement_image_url?: string | null;
};

export type DeliveryPdfData = {
  quotationNumber: string;
  customerName: string;
  phone?: string | null;
  address?: string | null;
  place?: string | null;
  deliveryPlace?: string | null;
  expectedDeliveryDate?: string | null;
  routeName?: string | null;
  vehicle?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  advanceAmount: number;
  balanceToCollect: number;
  notes?: string | null;
  items: DeliveryPdfItem[];
};

const money = (n: number) => `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0)}`;

const imageAsDataUrl = async (url?: string | null): Promise<string | null> => {
  const src = firstUrl(url);
  if (!src) return null;
  try {
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export async function createDeliveryHandoffPdf(data: DeliveryPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 14;

  const ensure = (need: number) => {
    if (y + need <= pageH - 14) return;
    doc.addPage();
    y = 14;
  };
  const line = (label: string, value?: string | null) => {
    if (!value) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, pageW - margin * 2 - 30);
    doc.text(lines, margin + 30, y);
    y += Math.max(5, lines.length * 4);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(COMPANY.name, margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${COMPANY.address}  |  ${COMPANY.phone}`, margin, y);
  y += 7;
  doc.setDrawColor(210);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("DELIVERY TEAM HANDOFF", margin, y);
  doc.setFontSize(10);
  doc.text(data.quotationNumber, pageW - margin, y, { align: "right" });
  y += 8;

  line("Customer", data.customerName);
  line("Phone", data.phone);
  line("Address", data.address || data.deliveryPlace || data.place);
  line("Route", data.routeName || "Route not assigned");
  line("Delivery", data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate).toLocaleDateString("en-IN") : "Not set");
  line("Vehicle", data.vehicle);
  line("Driver", [data.driverName, data.driverPhone].filter(Boolean).join(" · "));
  y += 2;

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, pageW - margin * 2, 19, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("ADVANCE RECEIVED", margin + 5, y + 6);
  doc.text("BALANCE TO COLLECT", pageW / 2 + 5, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(money(data.advanceAmount), margin + 5, y + 14);
  doc.text(money(data.balanceToCollect), pageW / 2 + 5, y + 14);
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Items (${data.items.length})`, margin, y);
  y += 6;

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    ensure(34);
    const boxY = y;
    doc.setDrawColor(220);
    doc.roundedRect(margin, boxY, pageW - margin * 2, 30, 2, 2);

    const imageUrl = item.item_image_url || item.catalog_image_url || item.measurement_image_url;
    const image = await imageAsDataUrl(imageUrl);
    let textX = margin + 5;
    if (image) {
      try {
        const fmt = image.startsWith("data:image/png") ? "PNG" : "JPEG";
        doc.addImage(image, fmt, margin + 4, boxY + 4, 22, 22, undefined, "FAST");
        textX = margin + 30;
      } catch {
        textX = margin + 5;
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const title = doc.splitTextToSize(`${i + 1}. ${item.description}`, pageW - textX - margin - 30);
    doc.text(title, textX, boxY + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let detailY = boxY + 14;
    if (item.catalog_text) {
      doc.text(`Code: ${item.catalog_text}`, textX, detailY);
      detailY += 5;
    }
    if (item.measurement) {
      const ms = doc.splitTextToSize(`Size: ${item.measurement}`, pageW - textX - margin - 30);
      doc.text(ms.slice(0, 2), textX, detailY);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Qty ${Number(item.quantity) || 0}`, pageW - margin - 5, boxY + 15, { align: "right" });
    y += 34;
  }

  if (data.notes) {
    ensure(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("NOTES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const notes = doc.splitTextToSize(data.notes, pageW - margin * 2);
    doc.text(notes, margin, y);
    y += notes.length * 4 + 5;
  }

  ensure(24);
  y += 3;
  doc.line(margin, y + 14, margin + 70, y + 14);
  doc.line(pageW - margin - 70, y + 14, pageW - margin, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Delivered by / Driver", margin, y + 19);
  doc.text("Customer signature / date", pageW - margin - 70, y + 19);

  return doc.output("blob");
}
