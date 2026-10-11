import { config } from "@/config";
import { formatDate } from "@/lib/dates";
import { dummyPhotoPng } from "./dummyPhoto";
import type { IdCardData } from "./idCardData";

/**
 * Builds the ID card PDF (credit-card size, front + back) and downloads it.
 * Demo: generated in the browser. The backend will stream the same layout from
 * GET /students/{id}/id-card.pdf (REQUIREMENTS §16.6).
 */
export async function downloadIdCardPdf(card: IdCardData): Promise<void> {
  const { jsPDF } = await import("jspdf"); // loaded only when someone downloads a card
  const W = 85.6;
  const H = 54;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });
  const navy: [number, number, number] = [35, 73, 155];
  const orange: [number, number, number] = [242, 107, 79];
  const grey: [number, number, number] = [110, 110, 110];

  doc.setProperties({ title: `Shooter ID ${card.shooterId}`, subject: "Shooter ID card", creator: config.associationName });

  // ---- Front ----
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 11, "F");
  doc.setFillColor(...orange);
  doc.rect(0, 11, W, 0.8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(config.associationName.toUpperCase(), W / 2, 5, { align: "center" });
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.text("SHOOTER IDENTITY CARD", W / 2, 8.8, { align: "center" });

  const photo = await dummyPhotoPng();
  doc.addImage(photo, "PNG", 4, 14.5, 19, 23.75);
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.3);
  doc.rect(4, 14.5, 19, 23.75);

  const label = (text: string, x: number, y: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.8);
    doc.setTextColor(...grey);
    doc.text(text.toUpperCase(), x, y);
  };
  const value = (text: string, x: number, y: number, size = 7.5, color: [number, number, number] = [20, 20, 20]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, x, y);
  };

  const x = 26;
  label("Name", x, 16.5);
  value(doc.splitTextToSize(card.name, 55)[0] as string, x, 19.7, 8);
  label("Shooter ID", x, 23.7);
  value(card.shooterId, x, 27.2, 9.5, navy);
  label("Main event", x, 31);
  value(card.mainEvent, x, 34, 7);
  label("Valid till", 58, 31);
  value(formatDate(card.expiresOn), 58, 34, 7, orange);

  label("Address", 4, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(20, 20, 20);
  const addressLines = (doc.splitTextToSize(card.address, W - 8) as string[]).slice(0, 3);
  doc.text(addressLines, 4, 44.6, { lineHeightFactor: 1.2 });

  doc.setFillColor(...navy);
  doc.rect(0, H - 2.2, W, 2.2, "F");

  // ---- Back ----
  doc.addPage([W, H], "landscape");
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("CARD DETAILS", W / 2, 4.6, { align: "center" });

  const rows: [string, string][] = [
    ["Shooter ID", card.shooterId],
    ["Registration no.", card.registrationNo],
    ["District", card.district],
    ["Issued on", formatDate(card.issuedOn)],
    ["Valid till", formatDate(card.expiresOn)],
  ];
  rows.forEach(([k, v], i) => {
    const y = 12.5 + i * 5;
    label(k, 5, y);
    value(v, 30, y, 6.5);
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.setTextColor(...grey);
  const note = doc.splitTextToSize(
    `This card is the property of ${config.associationName}. It is valid only until the date shown. If found, please return it to the association office.`,
    46,
  ) as string[];
  doc.text(note, 5, 41);

  doc.setDrawColor(...grey);
  doc.setLineWidth(0.2);
  doc.line(56, 44, 81, 44);
  doc.setFontSize(5);
  doc.text("District Secretary", 68.5, 47, { align: "center" });

  doc.setFillColor(...orange);
  doc.rect(0, H - 2.2, W, 2.2, "F");

  doc.save(`Shooter-ID-${card.shooterId}.pdf`);
}
