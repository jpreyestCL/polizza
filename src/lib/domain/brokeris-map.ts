/**
 * Equivalencias de Brokeris (06 §8.4) hacia los nombres de la especificación.
 * Sirve para cargar historia. No inventa un estado cuando el código no existe.
 */

export type BrokerisProposalStatus = {
  status:
    | "DRAFT"
    | "SENT_TO_INSURER"
    | "REJECTED_BY_INSURER"
    | "ISSUED"
    | "CANCELLED"
    | "ANNULLED"
    | "DISCARDED"
    | "DELETED"
    | null;
  insurerObservation: boolean;
};

export function mapBrokerisProposalStatus(
  code: number,
  options: { hasPolicyNumber?: boolean } = {},
): BrokerisProposalStatus {
  switch (code) {
    case 1:
      return { status: "DRAFT", insurerObservation: false };
    case 2:
      return { status: "SENT_TO_INSURER", insurerObservation: false };
    case 3:
      return { status: "SENT_TO_INSURER", insurerObservation: true };
    case 4:
      return { status: "ISSUED", insurerObservation: false };
    case 5:
      return { status: "CANCELLED", insurerObservation: false };
    case 6:
      return {
        status: options.hasPolicyNumber ? "ANNULLED" : "DISCARDED",
        insurerObservation: false,
      };
    case 7:
      return { status: "DELETED", insurerObservation: false };
    case 8:
      return { status: null, insurerObservation: false };
    case 9:
      return { status: "REJECTED_BY_INSURER", insurerObservation: false };
    default:
      return { status: null, insurerObservation: false };
  }
}

export type BrokerisInitiator = "CLIENT" | "BROKER" | "INSURER" | "NON_PAYMENT";

export type BrokerisEndorsement = {
  code: string;
  initiatedBy: BrokerisInitiator;
  partyChangeKind: "INSURED" | "BENEFICIARY" | "CONTRACTOR" | null;
  mvpEnabled: boolean;
  /** En la migración, un tipo apagado en el MVP entra con método manual. */
  calcMethod: string;
  note: string | null;
};

const MVP_ENDORSEMENT = new Set([
  "ADD_ITEM",
  "REMOVE_ITEM",
  "REPLACE_ITEMS",
  "MODIFY_SUM_INSURED_PREMIUM",
  "MODIFY_DATA",
  "CHANGE_PARTY",
  "EXTENSION",
  "CANCELLATION",
  "TOTAL_LOSS_TERMINATION",
  "ANNULMENT",
  "REINSTATEMENT",
  "BROKER_CHANGE",
  "OTHER",
]);

const ENDORSEMENT_CALC: Record<string, string> = {
  ADD_ITEM: "PRORATA_DAYS",
  REMOVE_ITEM: "REFUND_PRORATA",
  REPLACE_ITEMS: "MANUAL",
  MODIFY_SUM_INSURED_PREMIUM: "PRORATA_DAYS",
  MODIFY_DATA: "NONE",
  CHANGE_PARTY: "NONE",
  EXTENSION: "DAYS_FACTOR",
  EXTENSION_REVERSAL: "REFUND_PRORATA",
  REDUCE_TERM: "REFUND_PRORATA",
  CANCELLATION: "REFUND_PRORATA",
  TOTAL_LOSS_TERMINATION: "NONE",
  ANNULMENT: "FULL_REFUND",
  REINSTATEMENT: "MANUAL",
  COMMISSION_CHANGE: "MANUAL",
  BROKER_CHANGE: "NONE",
  DECLARATION: "NONE",
  PREMIUM_ADJUSTMENT: "MANUAL",
  OTHER: "MANUAL",
};

type EndorsementSeed = {
  code: string;
  initiatedBy: BrokerisInitiator;
  partyChangeKind?: "INSURED" | "BENEFICIARY" | "CONTRACTOR";
  note?: string;
};

/** 03 §7.3. El 0 no está: es el movimiento de emisión, no un tipo. */
const ENDORSEMENTS: Record<number, EndorsementSeed> = {
  1: { code: "ADD_ITEM", initiatedBy: "CLIENT" },
  19: { code: "ADD_ITEM", initiatedBy: "CLIENT", note: "Vuelve a agregar un ítem eliminado." },
  2: { code: "REMOVE_ITEM", initiatedBy: "CLIENT" },
  29: { code: "REMOVE_ITEM", initiatedBy: "INSURER" },
  30: { code: "REPLACE_ITEMS", initiatedBy: "CLIENT" },
  12: { code: "MODIFY_SUM_INSURED_PREMIUM", initiatedBy: "CLIENT" },
  5: { code: "MODIFY_SUM_INSURED_PREMIUM", initiatedBy: "CLIENT" },
  10: { code: "MODIFY_DATA", initiatedBy: "CLIENT" },
  20: { code: "MODIFY_DATA", initiatedBy: "CLIENT" },
  21: { code: "MODIFY_DATA", initiatedBy: "CLIENT" },
  13: { code: "MODIFY_DATA", initiatedBy: "BROKER" },
  9: {
    code: "CHANGE_PARTY",
    initiatedBy: "CLIENT",
    note: "Elegir asegurado o beneficiario.",
  },
  33: { code: "CHANGE_PARTY", initiatedBy: "CLIENT", partyChangeKind: "CONTRACTOR" },
  18: { code: "EXTENSION", initiatedBy: "CLIENT" },
  38: { code: "EXTENSION", initiatedBy: "CLIENT" },
  37: { code: "EXTENSION_REVERSAL", initiatedBy: "CLIENT" },
  40: { code: "REDUCE_TERM", initiatedBy: "CLIENT" },
  11: { code: "CANCELLATION", initiatedBy: "CLIENT" },
  4: { code: "CANCELLATION", initiatedBy: "INSURER" },
  39: { code: "CANCELLATION", initiatedBy: "NON_PAYMENT" },
  32: {
    code: "TOTAL_LOSS_TERMINATION",
    initiatedBy: "INSURER",
    note: "Identificar el siniestro; si no, queda para revisar.",
  },
  16: { code: "ANNULMENT", initiatedBy: "CLIENT" },
  6: { code: "ANNULMENT", initiatedBy: "INSURER" },
  3: { code: "REINSTATEMENT", initiatedBy: "CLIENT" },
  7: { code: "REINSTATEMENT", initiatedBy: "INSURER" },
  26: { code: "COMMISSION_CHANGE", initiatedBy: "BROKER" },
  41: { code: "BROKER_CHANGE", initiatedBy: "CLIENT" },
  15: { code: "DECLARATION", initiatedBy: "CLIENT" },
  34: { code: "DECLARATION", initiatedBy: "CLIENT" },
  27: { code: "DECLARATION", initiatedBy: "INSURER" },
  28: { code: "DECLARATION", initiatedBy: "INSURER" },
  23: { code: "PREMIUM_ADJUSTMENT", initiatedBy: "INSURER" },
  24: { code: "PREMIUM_ADJUSTMENT", initiatedBy: "INSURER" },
  17: { code: "OTHER", initiatedBy: "CLIENT" },
  25: { code: "OTHER", initiatedBy: "BROKER" },
};

export function brokerisEndorsementIds(): number[] {
  return Object.keys(ENDORSEMENTS)
    .map(Number)
    .sort((a, b) => a - b);
}

export function mapBrokerisEndorsementType(code: number): string | null {
  return ENDORSEMENTS[code]?.code ?? null;
}

export function mapBrokerisEndorsement(code: number): BrokerisEndorsement | null {
  const seed = ENDORSEMENTS[code];
  if (!seed) return null;
  const mvpEnabled = MVP_ENDORSEMENT.has(seed.code);
  return {
    code: seed.code,
    initiatedBy: seed.initiatedBy,
    partyChangeKind: seed.partyChangeKind ?? null,
    mvpEnabled,
    calcMethod: mvpEnabled ? ENDORSEMENT_CALC[seed.code] : "MANUAL",
    note: seed.note ?? null,
  };
}

/** El endoso 0 de Brokeris es la emisión de la póliza. */
export function mapBrokerisMovementKind(
  endorsementTypeId: number,
): "ISSUE" | "ENDORSEMENT" | null {
  if (endorsementTypeId === 0) return "ISSUE";
  if (ENDORSEMENTS[endorsementTypeId]) return "ENDORSEMENT";
  return null;
}

const PAYMENT_CODES: Record<number, string> = {
  408: "SINGLE",
  409: "CHECKS",
  410: "PAC",
  411: "PAT",
  412: "OTHER",
  413: "DIRECT_BILL",
  414: "COUPON_BOOK",
};

export function mapBrokerisPaymentMethod(code: number): string | null {
  return PAYMENT_CODES[code] ?? null;
}

const CURRENCY_CODES: Record<number, string> = {
  1: "CLF",
  2: "USD",
  3: "CLP",
  4: "EUR",
  8: "USD",
  12: "USD",
  13: "UTM",
  15: "CLP",
};

export function mapBrokerisCurrency(code: number): string | null {
  return CURRENCY_CODES[code] ?? null;
}

const CLAIM_CODES: Record<number, string> = {
  1: "IN_ADJUSTMENT",
  2: "REPORTED",
  3: "AWAITING_ASSIGNMENT",
  4: "PAYMENT_PROCESS",
  5: "CLOSED",
  6: "VOID",
  8: "IN_ADJUSTMENT",
  9: "PAYMENT_PROCESS",
  10: "AWAITING_ASSIGNMENT",
};

export function mapBrokerisClaimStatus(code: number): string | null {
  return CLAIM_CODES[code] ?? null;
}

const DISPATCH_CODES: Record<number, string> = {
  1: "PENDING",
  2: "SENT_UNCONFIRMED",
  3: "DELIVERED",
  4: "RETURNED",
};

export function mapBrokerisDispatchStatus(code: number): string | null {
  return DISPATCH_CODES[code] ?? null;
}

export type BrokerisClientType = {
  kind: "PERSON" | "ORGANIZATION" | "GROUP";
  sector: "PRIVATE" | "STATE" | "CORPORATE" | null;
};

export function mapBrokerisClientType(code: number): BrokerisClientType | null {
  switch (code) {
    case 1:
      return { kind: "ORGANIZATION", sector: "PRIVATE" };
    case 2:
      return { kind: "PERSON", sector: null };
    case 3:
      return { kind: "ORGANIZATION", sector: "STATE" };
    case 4:
      return { kind: "GROUP", sector: null };
    case 5:
      return { kind: "ORGANIZATION", sector: "CORPORATE" };
    default:
      return null;
  }
}

export type BrokerisProfile =
  | "ADMIN"
  | "ACCOUNT_EXECUTIVE"
  | "CLAIMS"
  | "COLLECTIONS"
  | "FINANCE";

export function mapBrokerisProfile(code: string): BrokerisProfile | null {
  switch (code.trim().toUpperCase()) {
    case "ADMINISTRADOR":
      return "ADMIN";
    case "SUSCRIPTOR":
      return "ACCOUNT_EXECUTIVE";
    case "SINIESTRO":
      return "CLAIMS";
    case "COBRANZA":
      return "COLLECTIONS";
    case "FINANZAS":
      return "FINANCE";
    default:
      return null;
  }
}

const NON_RENEWAL_REASONS: Record<number, string> = {
  22: "CLIENT_REQUEST",
  14: "CLAIM_SERVICE",
  1: "BROKER_CHANGE",
  2: "BUSINESS_CLOSED",
  19: "INSURER_CHANGE",
  12: "COVERAGE",
  18: "RESTRICTED_TERMS",
  10: "INSURER_DECISION",
  8: "BULK",
  21: "MERGED_POLICY",
  5: "OTHER",
  23: "REPLACED",
  11: "PRICE",
  9: "BANKRUPTCY",
  13: "SERVICE",
  20: "NO_MARKET",
  15: "NO_CLIENT_RESPONSE",
  7: "ECONOMIC_SITUATION",
  16: "PROJECT_ENDED",
  17: "SINGLE_SHIPMENT",
  4: "ASSET_SOLD",
  3: "TOTAL_LOSS",
  6: "CANCELLED_MIDTERM",
};

export function brokerisNonRenewalReasonIds(): number[] {
  return Object.keys(NON_RENEWAL_REASONS)
    .map(Number)
    .sort((a, b) => a - b);
}

export function mapBrokerisNonRenewalType(
  code: number,
): "NOT_RENEWABLE" | "NOT_RENEWED" | null {
  if (code === 1) return "NOT_RENEWABLE";
  if (code === 2) return "NOT_RENEWED";
  return null;
}

export function mapBrokerisNonRenewalReason(code: number): string | null {
  return NON_RENEWAL_REASONS[code] ?? null;
}

const PAYMENT_FREQUENCY: Record<number, string> = {
  408: "SINGLE",
  596: "MONTHLY",
  597: "QUARTERLY",
  598: "SEMIANNUAL",
  599: "ANNUAL",
};

export function mapBrokerisPaymentFrequency(code: number): string | null {
  return PAYMENT_FREQUENCY[code] ?? null;
}

const DISPATCH_TYPES: Record<number, string> = {
  1: "EMAIL",
  2: "CERTIFIED_MAIL",
  7: "REGULAR_MAIL",
  3: "POUCH",
  4: "BY_HAND",
  8: "OWN_COURIER",
  5: "NONE",
  6: "OTHER",
};

export function mapBrokerisDispatchType(code: number): string | null {
  return DISPATCH_TYPES[code] ?? null;
}

const CLAIM_SUBSTATUS: Record<number, string> = {
  1: "REPORT_PENDING_SEND",
  2: "AWAITING_INSURER_ASSIGNMENT",
  44: "REPORTED_AND_ASSIGNED",
  74: "ADJUSTER_NOTIFIED",
  3: "REQUESTING_DOCUMENTS",
  4: "AWAITING_DOCUMENTS",
  63: "INSPECTION_IN_PROGRESS",
  41: "PENDING_WORKSHOP_ENTRY",
  30: "AWAITING_ESTIMATE",
  82: "REPAIR_ORDER_ISSUED",
  40: "IN_REPAIR",
  61: "TOTAL_LOSS_DETERMINATION",
  5: "AWAITING_ADJUSTMENT_REPORT",
  6: "AWAITING_INSURER_PAYMENT",
  45: "PENDING_RELEASE_SIGNATURE",
  34: "DISPUTED",
  7: "CLOSING_IN_PROGRESS",
  8: "CLOSED",
};

export function mapBrokerisClaimSubstatus(code: number): {
  status: string;
  note: string | null;
} {
  const status = CLAIM_SUBSTATUS[code];
  if (status) return { status, note: null };
  return { status: "REPORTED", note: `Subestado sin mapa: ${code}` };
}

const CLAIM_CLOSURE: Record<number, { label: string; outcome: string }> = {
  1: { label: "Asegurado no muestra vehículo para inspección", outcome: "WITHDRAWN" },
  2: { label: "Bajo deducible", outcome: "BELOW_DEDUCTIBLE" },
  3: { label: "Cierre por cambio corredor", outcome: "OTHER" },
  4: { label: "Con Orden de Trabajo", outcome: "REPAIRED" },
  5: { label: "Desistido", outcome: "WITHDRAWN" },
  6: { label: "Falta de antecedentes", outcome: "MISSING_DOCUMENTS" },
  7: { label: "Pagado", outcome: "PAID" },
  8: { label: "Preventivo", outcome: "PREVENTIVE" },
  9: { label: "Rechazado", outcome: "REJECTED" },
  10: { label: "Reclamo", outcome: "OTHER" },
  11: { label: "Reparado", outcome: "REPAIRED" },
  12: { label: "Plan de Pago", outcome: "PAID" },
  13: { label: "Anulado", outcome: "DUPLICATE_OR_ERROR" },
  14: { label: "Preexistencia", outcome: "REJECTED" },
  15: { label: "Con Sentencia definitiva", outcome: "JUDICIAL" },
  16: { label: "Respaldo da cuenta de pago", outcome: "PAID" },
  17: { label: "Acuerdo Extrajudicial", outcome: "JUDICIAL" },
  18: { label: "Sin Cobertura", outcome: "REJECTED" },
  19: { label: "Cierre por no ingreso a Taller", outcome: "WITHDRAWN" },
  20: { label: "Cerrado a la espera de valor orden", outcome: "REPAIRED" },
  21: { label: "Cerrado sin Pago", outcome: "NO_PAYMENT_OTHER" },
  22: { label: "Duplicado", outcome: "DUPLICATE_OR_ERROR" },
  23: { label: "Error interno", outcome: "DUPLICATE_OR_ERROR" },
  24: { label: "Rechazado - Sin cobertura para el evento", outcome: "REJECTED" },
  25: { label: "Rechazado - No cumple con condición de la póliza", outcome: "REJECTED" },
  26: { label: "Rechazado - Falta interés asegurable", outcome: "REJECTED" },
  27: { label: "Rechazado - Respuesta impugnación Negativa", outcome: "REJECTED" },
  28: { label: "Rechazado - Respuesta de peritaje negativo", outcome: "REJECTED" },
  29: { label: "Sin Reclamación", outcome: "WITHDRAWN" },
  30: { label: "Daños a Terceros sin Cobro", outcome: "NO_PAYMENT_OTHER" },
  31: { label: "Cierre por Plazo", outcome: "WITHDRAWN" },
  32: { label: "Falta Documento Contable", outcome: "MISSING_DOCUMENTS" },
  33: { label: "Resuelto", outcome: "OTHER" },
  34: { label: "Con Causa Judicial vigente", outcome: "JUDICIAL" },
  35: { label: "Solo Infraccional", outcome: "NO_PAYMENT_OTHER" },
  36: { label: "Denuncio no Califica", outcome: "REJECTED" },
  37: { label: "Pagado en otro siniestro", outcome: "DUPLICATE_OR_ERROR" },
  38: { label: "Pagado por Pérdida Total", outcome: "PAID" },
  39: { label: "Causa Archivada", outcome: "JUDICIAL" },
  40: { label: "Cierre temporal – A la espera de baja fiscal", outcome: "TEMPORARY" },
};

export function brokerisClaimClosureIds(): number[] {
  return Object.keys(CLAIM_CLOSURE)
    .map(Number)
    .sort((a, b) => a - b);
}

export function mapBrokerisClaimClosure(
  code: number,
): { label: string; outcome: string } | null {
  return CLAIM_CLOSURE[code] ?? null;
}

const DOCUMENT_TYPES: Record<string, string> = {
  poliza: "POLICY",
  "documento poliza pdf": "POLICY",
  "condiciones generales": "POLICY",
  soap: "POLICY",
  endoso: "ENDORSEMENT",
  "documento endoso pdf": "ENDORSEMENT",
  "propuesta aceptada cia": "APPLICATION",
  "propuesta firma cliente": "APPLICATION",
  "propuesta despacho": "APPLICATION",
  "solicitud de seguro": "APPLICATION",
  "cotizacion compania": "INSURER_QUOTE",
  "negociacion compania / cotizacion": "INSURER_QUOTE",
  "informacion para cotizar": "INSURER_QUOTE",
  "adjunto cotizaciones y cuadro comparativo": "COMPARISON",
  "plan de pago enviado": "PAYMENT_PLAN",
  "plan de pago firmado": "PAYMENT_PLAN",
  "tabla de desarrollo de la deuda": "PAYMENT_PLAN",
  "mandato pac/pat": "PAYMENT_MANDATE",
  "comprobante de pago": "PAYMENT_RECEIPT",
  "registro de pago": "PAYMENT_RECEIPT",
  "respaldo de indemnizacion": "PAYMENT_RECEIPT",
  factura: "INSURER_INVOICE",
  "factura anticipada de la cia": "INSURER_INVOICE",
  "nota de credito": "INSURER_INVOICE",
  "nota de debito": "INSURER_INVOICE",
  "aviso cobranza": "INSURER_INVOICE",
  "documento cobranza": "INSURER_INVOICE",
  "devolucion de primas": "INSURER_INVOICE",
  denuncio: "CLAIM_REPORT",
  "denuncio generado en sistema (con bitacora)": "CLAIM_REPORT",
  "denuncio generado en sistema (sin bitacora)": "CLAIM_REPORT",
  "reclamacion de perdida": "CLAIM_REPORT",
  "parte policial": "POLICE_REPORT",
  "parte policial e informe de bomberos": "POLICE_REPORT",
  alcoholemia: "POLICE_REPORT",
  "carpeta investigativa fiscalia": "POLICE_REPORT",
  liquidaciones: "ADJUSTMENT_REPORT",
  "pre informe liquidacion": "ADJUSTMENT_REPORT",
  addendum: "ADJUSTMENT_REPORT",
  impugnacion: "ADJUSTMENT_REPORT",
  "liquidacion siniestro soap": "ADJUSTMENT_REPORT",
  "informe tecnico de tercero especialista": "ADJUSTMENT_REPORT",
  finiquito: "SETTLEMENT_RELEASE",
  "finiquito firmado": "SETTLEMENT_RELEASE",
  "presupuesto de reparacion": "REPAIR_ESTIMATE",
  "presupuesto reparacion danos terceros": "REPAIR_ESTIMATE",
  "presupuesto o factura danos propios": "REPAIR_ESTIMATE",
  "orden de compra": "REPAIR_ESTIMATE",
  imagenes: "PHOTOS",
  "grabacion del accidente": "PHOTOS",
  "fotografias o inf tecnico rotura caneria": "PHOTOS",
  inspeccion: "INSPECTION",
  "check list": "INSPECTION",
  "cedula de identidad": "ID_DOCUMENT",
  "licencia de conducir": "ID_DOCUMENT",
  padron: "VEHICLE_REGISTRATION",
  "padron del vehiculo": "VEHICLE_REGISTRATION",
  "certificado de anotaciones vigentes": "VEHICLE_REGISTRATION",
  "permiso de circulacion": "VEHICLE_REGISTRATION",
  "revision tecnica": "VEHICLE_REGISTRATION",
  "boletas, facturas, comprobantes de pago bienes": "PURCHASE_INVOICE",
  "guias de despacho": "PURCHASE_INVOICE",
  contrato: "CONTRACT_OR_BID",
  "bases de licitacion": "CONTRACT_OR_BID",
  adjudicacion: "CONTRACT_OR_BID",
  "contrato de prestaciones de servicio de maq": "CONTRACT_OR_BID",
  "mail de autorizacion": "CREDITOR_AUTHORIZATION",
  siniestralidad: "LOSS_HISTORY",
  carta: "CORRESPONDENCE",
  correo: "CORRESPONDENCE",
  whatsapp: "CORRESPONDENCE",
  "carta de renovacion": "CORRESPONDENCE",
  "carta de vencimiento": "CORRESPONDENCE",
  "carta de cobranza": "CORRESPONDENCE",
  "aceptacion asegurado/contratante": "CORRESPONDENCE",
  confirmacion: "CORRESPONDENCE",
  rechazo: "CORRESPONDENCE",
  "otros docs": "OTHER",
};

function documentKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapBrokerisDocumentType(label: string): {
  code: string;
  needsReview: boolean;
  legacyType: string;
} {
  const legacyType = label.trim();
  const code = DOCUMENT_TYPES[documentKey(legacyType)];
  if (!code) return { code: "OTHER", needsReview: true, legacyType };
  return { code, needsReview: false, legacyType };
}
