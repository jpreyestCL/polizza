import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

export const BROKERIS_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const BROKERIS_FILE_MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const BROKERIS_FILE_MAX_ROWS = 100_000;
export const BROKERIS_FILE_MAX_COLUMNS = 100;

const SUPPORTED_EXTENSIONS = new Set(["csv", "tsv", "xlsx"]);

export type BrokerisParsedFile = {
  matrix: string[][];
  text: string;
};

/**
 * Reads only the first worksheet and converts its matrix to the tab-delimited
 * text consumed by the existing, profile-specific Brokeris translator.
 * It deliberately does not infer a source layout.
 */
export function parseBrokerisFile(
  bytes: Uint8Array,
  fileName: string,
): BrokerisParsedFile {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Formato no soportado. Usa CSV, TSV o XLSX.");
  }
  if (bytes.byteLength === 0) throw new Error("El archivo está vacío.");
  if (bytes.byteLength > BROKERIS_FILE_MAX_BYTES) {
    throw new Error("El archivo supera el máximo de 10 MB.");
  }
  if (extension === "xlsx") assertSafeZipSize(bytes);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      raw: true,
      cellDates: false,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      dense: true,
    });
  } catch {
    throw new Error("No se pudo leer el archivo.");
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("El archivo no contiene una hoja.");
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) throw new Error("No se pudo leer la primera hoja.");

  const source = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (source.length > BROKERIS_FILE_MAX_ROWS) {
    throw new Error("El archivo supera el máximo de 100.000 filas.");
  }

  const matrix = source.map((row) => {
    if (row.length > BROKERIS_FILE_MAX_COLUMNS) {
      throw new Error("El archivo supera el máximo de 100 columnas.");
    }
    return row.map(normalizeCell);
  });
  const text = matrix
    .filter((row) => row.some(Boolean))
    .map((row) => row.join("\t"))
    .join("\n");
  if (!text) throw new Error("La primera hoja no contiene filas.");

  return { matrix, text };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeCell(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

/** Refuses oversized/Zip64 XLSX archives before the library expands them. */
function assertSafeZipSize(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let uncompressedBytes = 0;
  let entries = 0;
  for (let offset = 0; offset + 46 <= view.byteLength; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const size = view.getUint32(offset + 24, true);
    if (size === 0xffffffff) {
      throw new Error("El XLSX usa un formato ZIP no soportado.");
    }
    uncompressedBytes += size;
    entries += 1;
    if (uncompressedBytes > BROKERIS_FILE_MAX_UNCOMPRESSED_BYTES) {
      throw new Error("El contenido expandido del XLSX supera el máximo de 100 MB.");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    offset += 45 + nameLength + extraLength + commentLength;
  }
  if (entries === 0) throw new Error("El XLSX no contiene una estructura ZIP válida.");
}
