import jsPDF from "jspdf";
import { COMPANY } from "@/lib/companyInfo";
import { formatINR } from "@/lib/brand";

export type ReceivableReceiptData = {
  receiptNo: string;
  orderNo: string | null;
  customerName: string | null;
  place: string | null;
  phone: string | null;
  amount: number;
  paymentMethod: string | null;
  referenceNo: string | null;
  receivedAt: string;
  currentBalance: number;
};

const methodLabel = (v: string | null) => ({
  cash: "Cash",
  upi: "UPI / GPay",
  card: "Card",
  bank: "Bank Transfer",
  cheque: "Cheque",
  other: "Other",
}[v || ""] || v || "—");

export function generateReceivableReceiptPdf(data: ReceivableReceiptData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 18;
  const right = 192;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(COMPANY.name, left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 6;
  doc.text(COMPANY.address, left, y);
  y += 5;
  doc.text(COMPANY.phone, left, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("PAYMENT RECEIPT", right, 20, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Receipt: ${data.receiptNo}`, right, 27, { align: "right" });
  doc.text(new Date(data.receivedAt).toLocaleString("en-IN"), right, 32, { align: "right" });

  y = 43;
  doc.setDrawColor(210);
  doc.line(left, y, right, y);
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("RECEIVED FROM", left, y);
  y += 6;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(data.customerName || "Customer", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.place) { y += 5; doc.text(data.place, left, y); }
  if (data.phone) { y += 5; doc.text(`Phone: ${data.phone}`, left, y); }

  y += 12;
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(left, y, right - left, 45, 2, 2, "F");
  const boxY = y;
  y += 9;
  doc.setTextColor(100);
  doc.setFontSize(9);
  doc.text("AMOUNT RECEIVED", left + 6, y);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  y += 10;
  doc.text(formatINR(data.amount), left + 6, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 10;
  const details = [
    data.orderNo ? `Order: ${data.orderNo}` : null,
    `Method: ${methodLabel(data.paymentMethod)}`,
    data.referenceNo ? `Reference: ${data.referenceNo}` : null,
  ].filter(Boolean).join("   •   ");
  doc.text(details, left + 6, y, { maxWidth: right - left - 12 });

  y = boxY + 57;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Balance to Receive", left, y);
  doc.text(formatINR(Math.max(0, data.currentBalance)), right, y, { align: "right" });

  y += 10;
  doc.setDrawColor(220);
  doc.line(left, y, right, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("Thank you. This receipt confirms the amount received by Hitech Furniture & Interiors.", left, y, { maxWidth: right - left });
  y += 8;
  doc.text("Computer-generated receipt — signature not required.", left, y);

  return doc.output("blob");
}
