import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CarQuotationDetail } from "./queries";
import {
  CIVIL_LIABILITY_LABELS,
  VEHICLE_CONDITION_LABELS,
  VEHICLE_USE_LABELS,
  WORKSHOP_TYPE_LABELS,
  type CivilLiabilityValue,
  type VehicleConditionValue,
  type VehicleUseValue,
  type WorkshopTypeValue,
} from "./schemas";

function fmtUf(n: number | null): string {
  return n === null ? "—" : `UF ${n.toFixed(2)}`;
}

export async function buildComparativePdf(
  quotation: CarQuotationDetail,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]); // A4 horizontal
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.15, 0.19, 0.23);
  const muted = rgb(0.45, 0.5, 0.55);
  const accent = rgb(0.12, 0.44, 0.47);
  const stripe = rgb(0.96, 0.97, 0.98);

  page.drawText("Comparativo de cotizaciones", {
    x: 40,
    y: 555,
    size: 20,
    font: bold,
    color: accent,
  });
  page.drawText(quotation.quotationNumber, {
    x: 40,
    y: 535,
    size: 11,
    font,
    color: muted,
  });
  page.drawText(quotation.client.name, {
    x: 40,
    y: 520,
    size: 11,
    font,
    color: ink,
  });

  const vehicleParts = [
    quotation.patente,
    [quotation.marca, quotation.modelo, quotation.anio].filter(Boolean).join(" "),
    `RC ${CIVIL_LIABILITY_LABELS[quotation.civilLiability as CivilLiabilityValue]}`,
    WORKSHOP_TYPE_LABELS[quotation.workshopType as WorkshopTypeValue],
    `${VEHICLE_CONDITION_LABELS[quotation.vehicleCondition as VehicleConditionValue]} · ${VEHICLE_USE_LABELS[quotation.vehicleUse as VehicleUseValue]}`,
  ].filter(Boolean);
  page.drawText(vehicleParts.join(" · "), {
    x: 40,
    y: 503,
    size: 10,
    font,
    color: muted,
  });

  // Tabla
  const obtained = quotation.results.filter((r) => r.status === "OBTENIDA");
  const sorted = [...obtained].sort(
    (a, b) => (a.premiumUf ?? Infinity) - (b.premiumUf ?? Infinity),
  );
  const headers = ["Aseguradora", "Plan", "Prima anual", "Deducible", "Diferencia vs. mejor"];
  const cols = [40, 240, 430, 560, 680];
  const headerY = 470;
  page.drawLine({
    start: { x: 40, y: headerY + 15 },
    end: { x: 800, y: headerY + 15 },
    thickness: 0.5,
    color: muted,
  });
  headers.forEach((h, i) => {
    page.drawText(h, {
      x: cols[i]!,
      y: headerY,
      size: 10,
      font: bold,
      color: ink,
    });
  });
  page.drawLine({
    start: { x: 40, y: headerY - 6 },
    end: { x: 800, y: headerY - 6 },
    thickness: 0.5,
    color: muted,
  });

  const best = sorted[0]?.premiumUf ?? null;
  let y = headerY - 24;
  sorted.forEach((r, idx) => {
    if (idx % 2 === 0) {
      page.drawRectangle({
        x: 40,
        y: y - 6,
        width: 760,
        height: 22,
        color: stripe,
      });
    }
    const diff =
      best && r.premiumUf ? r.premiumUf - best : 0;
    const diffText =
      idx === 0
        ? "Mejor oferta"
        : `+UF ${diff.toFixed(2)} (${best ? ((diff / best) * 100).toFixed(1) : "0"}%)`;
    page.drawText(r.insurerName, {
      x: cols[0]!,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    page.drawText(r.planName ?? "—", { x: cols[1]!, y, size: 10, font, color: ink });
    page.drawText(fmtUf(r.premiumUf), {
      x: cols[2]!,
      y,
      size: 10,
      font: bold,
      color: idx === 0 ? accent : ink,
    });
    page.drawText(fmtUf(r.deductibleUf), {
      x: cols[3]!,
      y,
      size: 10,
      font,
      color: ink,
    });
    page.drawText(diffText, {
      x: cols[4]!,
      y,
      size: 10,
      font,
      color: idx === 0 ? accent : muted,
    });
    y -= 26;
  });

  if (sorted.length === 0) {
    page.drawText("Sin cotizaciones obtenidas aún.", {
      x: 40,
      y: y,
      size: 11,
      font,
      color: muted,
    });
  }

  // Errores
  const errors = quotation.results.filter((r) => r.status === "ERROR");
  if (errors.length > 0) {
    y -= 20;
    page.drawText("Sin resultado", {
      x: 40,
      y,
      size: 11,
      font: bold,
      color: muted,
    });
    y -= 16;
    for (const e of errors) {
      page.drawText(`• ${e.insurerName}: ${e.errorMessage ?? "Error"}`, {
        x: 40,
        y,
        size: 9,
        font,
        color: muted,
      });
      y -= 13;
    }
  }

  page.drawText(
    `Generado el ${new Date().toLocaleString("es-CL")} — Polizza`,
    { x: 40, y: 30, size: 8, font, color: muted },
  );

  return Buffer.from(await pdf.save());
}

export function buildComparativeCsv(quotation: CarQuotationDetail): string {
  const headers = [
    "Aseguradora",
    "Plan",
    "Estado",
    "Prima UF",
    "Deducible UF",
    "Mensaje",
  ];
  const lines = quotation.results.map((r) =>
    [
      r.insurerName,
      r.planName ?? "",
      r.status,
      r.premiumUf?.toFixed(2) ?? "",
      r.deductibleUf?.toFixed(2) ?? "",
      r.errorMessage ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}
