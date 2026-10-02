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

const ENDORSEMENT_CODES: Record<number, string> = {
  13: "MODIFY_DATA",
  15: "DECLARATION",
  23: "PREMIUM_ADJUSTMENT",
  24: "PREMIUM_ADJUSTMENT",
  27: "DECLARATION",
  28: "DECLARATION",
  32: "TOTAL_LOSS_TERMINATION",
  34: "DECLARATION",
  37: "EXTENSION_REVERSAL",
  40: "REDUCE_TERM",
};

export function mapBrokerisEndorsementType(code: number): string | null {
  return ENDORSEMENT_CODES[code] ?? null;
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

export function mapBrokerisProfile(code: string): "ADMIN" | null {
  if (code.trim().toUpperCase() === "ADMINISTRADOR") return "ADMIN";
  return null;
}
