import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  InsurerAdapter,
  InsurerQuoteResult,
  QuotationInput,
} from "./types";

/**
 * Hash determinista sencillo para generar primas estables a partir de los
 * inputs: la misma cotización siempre devuelve el mismo precio.
 */
function hashCode(parts: string[]): number {
  const str = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickDeductible(input: QuotationInput, h: number): number {
  if (input.deductiblesUf.length > 0) {
    return input.deductiblesUf[h % input.deductiblesUf.length]!;
  }
  const defaults = [0, 3, 5, 10, 15];
  return defaults[h % defaults.length]!;
}

function computePremium(
  input: QuotationInput,
  insurerKey: string,
  deductible: number,
): number {
  const insurerSeed = hashCode([insurerKey]);
  const inputSeed = hashCode([
    input.patente,
    input.marca ?? "",
    input.modelo ?? "",
    String(input.anio ?? 0),
    input.vehicleCondition,
    input.vehicleUse,
    String(input.civilLiabilityUf),
    input.workshopType,
  ]);
  // Base 14 UF, +/- 30% por aseguradora, +/- 25% por inputs.
  const insurerFactor = 0.7 + (insurerSeed % 600) / 1000;
  const inputFactor = 0.75 + (inputSeed % 500) / 1000;
  let premium = 14 * insurerFactor * inputFactor;
  if (input.vehicleCondition === "NUEVO") premium *= 1.18;
  if (input.vehicleUse === "COMERCIAL") premium *= 1.25;
  if (input.workshopType === "MARCA") premium *= 1.12;
  const rcMap: Record<number, number> = {
    500: 1,
    1000: 1.08,
    1500: 1.14,
    2000: 1.2,
  };
  premium *= rcMap[input.civilLiabilityUf] ?? 1;
  // Más deducible → menos prima.
  premium *= 1 - Math.min(deductible, 20) * 0.012;
  return Math.round(premium * 100) / 100;
}

async function buildPdf(opts: {
  insurerName: string;
  input: QuotationInput;
  premiumUf: number;
  deductibleUf: number;
  planName: string;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.15, 0.19, 0.23);
  const muted = rgb(0.45, 0.5, 0.55);
  const accent = rgb(0.12, 0.44, 0.47);

  page.drawText(opts.insurerName, {
    x: 40,
    y: 790,
    size: 18,
    font: bold,
    color: accent,
  });
  page.drawText("Cotización de seguro automotriz (simulada)", {
    x: 40,
    y: 770,
    size: 10,
    font,
    color: muted,
  });
  page.drawLine({
    start: { x: 40, y: 758 },
    end: { x: 555, y: 758 },
    thickness: 0.5,
    color: muted,
  });

  let y = 730;
  const drawRow = (label: string, value: string) => {
    page.drawText(label, { x: 40, y, size: 10, font, color: muted });
    page.drawText(value, { x: 200, y, size: 11, font: bold, color: ink });
    y -= 22;
  };

  drawRow("Asegurado", opts.input.client.name);
  drawRow("RUT", opts.input.client.rut);
  drawRow("Patente", opts.input.patente);
  drawRow(
    "Vehículo",
    [opts.input.marca, opts.input.modelo, opts.input.anio]
      .filter(Boolean)
      .join(" ") || "—",
  );
  drawRow("Motorización", opts.input.motorizacion ?? "—");
  drawRow(
    "Tipo / Estado",
    `${opts.input.tipoVehiculo ?? "—"} · ${opts.input.vehicleCondition === "NUEVO" ? "Nuevo" : "Usado"}`,
  );
  drawRow(
    "Uso",
    opts.input.vehicleUse === "PARTICULAR" ? "Particular" : "Comercial",
  );
  drawRow("Responsabilidad civil", `UF ${opts.input.civilLiabilityUf}`);
  drawRow(
    "Taller",
    opts.input.workshopType === "EXCLUSIVIDAD"
      ? "Exclusividad de taller"
      : "Taller de marca",
  );
  drawRow("Plan", opts.planName);
  drawRow("Deducible", `UF ${opts.deductibleUf.toFixed(2)}`);

  y -= 10;
  page.drawLine({
    start: { x: 40, y },
    end: { x: 555, y },
    thickness: 0.5,
    color: muted,
  });
  y -= 30;

  page.drawText("Prima anual", { x: 40, y, size: 12, font, color: muted });
  page.drawText(`UF ${opts.premiumUf.toFixed(2)}`, {
    x: 200,
    y,
    size: 22,
    font: bold,
    color: accent,
  });

  y -= 60;
  page.drawText(
    "Documento generado por simulación. Reemplaza este adaptador por el scraper real",
    { x: 40, y, size: 8, font, color: muted },
  );
  page.drawText("del portal de la aseguradora cuando esté disponible.", {
    x: 40,
    y: y - 11,
    size: 8,
    font,
    color: muted,
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/**
 * Construye un adaptador "simulado" para una aseguradora. Genera resultados
 * deterministas y un PDF de cotización con estructura típica. Reemplazable
 * por el scraper real (Playwright + parser de PDF) sin tocar el resto del
 * sistema.
 */
export function createSimulatedAdapter(
  key: string,
  name: string,
): InsurerAdapter {
  return {
    key,
    name,
    requiresCredentials: false,
    async quote(input): Promise<InsurerQuoteResult> {
      // Pausa simulada (200–800 ms) para asemejar la red.
      const h = hashCode([key, input.patente, input.marca ?? ""]);
      const delay = 200 + (h % 600);
      await new Promise((r) => setTimeout(r, delay));

      const deductibleUf = pickDeductible(input, h);
      const premiumUf = computePremium(input, key, deductibleUf);
      const planName =
        input.workshopType === "MARCA" ? "Full Marca" : "Estándar Convenio";

      const coverageDetail = {
        responsabilidadCivilUf: input.civilLiabilityUf,
        taller:
          input.workshopType === "MARCA"
            ? "Taller de marca"
            : "Exclusividad de taller",
        deducibleUf: deductibleUf,
        coberturasIncluidas: [
          "Daños propios",
          "Robo",
          "Responsabilidad civil",
          "Asistencia en ruta",
        ],
      };

      const pdf = await buildPdf({
        insurerName: name,
        input,
        premiumUf,
        deductibleUf,
        planName,
      });

      return {
        premiumUf,
        deductibleUf,
        planName,
        coverageDetail,
        rawData: { source: "simulated", insurerKey: key, hash: h },
        pdf,
      };
    },
  };
}
