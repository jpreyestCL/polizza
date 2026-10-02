/**
 * Dieciocho tipos de la especificación. Todos se pueden registrar.
 * Reemplazar ítems sigue en cálculo manual: no hay una lista de ítems
 * nuevos que la compañía haya emitido.
 */

export type SpecEndorsementType =
  | "ADD_ITEM"
  | "REMOVE_ITEM"
  | "REPLACE_ITEMS"
  | "MODIFY_SUM_INSURED_PREMIUM"
  | "MODIFY_DATA"
  | "CHANGE_PARTY"
  | "EXTENSION"
  | "CANCELLATION"
  | "TOTAL_LOSS_TERMINATION"
  | "ANNULMENT"
  | "REINSTATEMENT"
  | "BROKER_CHANGE"
  | "OTHER"
  | "EXTENSION_REVERSAL"
  | "REDUCE_TERM"
  | "COMMISSION_CHANGE"
  | "DECLARATION"
  | "PREMIUM_ADJUSTMENT";

export type CalcMethod =
  | "REFUND_PRORATA"
  | "PRORATA_DAYS"
  | "DAYS_FACTOR"
  | "FULL_REFUND"
  | "NONE"
  | "MANUAL";

export type SpecEndorsement = {
  code: SpecEndorsementType;
  mvpEnabled: boolean;
  calcMethod: CalcMethod;
};

const CALC: Record<SpecEndorsementType, CalcMethod> = {
  ADD_ITEM: "PRORATA_DAYS",
  REMOVE_ITEM: "REFUND_PRORATA",
  REPLACE_ITEMS: "MANUAL",
  MODIFY_SUM_INSURED_PREMIUM: "PRORATA_DAYS",
  MODIFY_DATA: "NONE",
  CHANGE_PARTY: "NONE",
  EXTENSION: "DAYS_FACTOR",
  CANCELLATION: "REFUND_PRORATA",
  TOTAL_LOSS_TERMINATION: "NONE",
  ANNULMENT: "FULL_REFUND",
  REINSTATEMENT: "MANUAL",
  BROKER_CHANGE: "NONE",
  OTHER: "MANUAL",
  EXTENSION_REVERSAL: "REFUND_PRORATA",
  REDUCE_TERM: "REFUND_PRORATA",
  COMMISSION_CHANGE: "MANUAL",
  DECLARATION: "NONE",
  PREMIUM_ADJUSTMENT: "MANUAL",
};

const APP_TYPE: Record<string, SpecEndorsementType> = {
  AGREGA_ITEMS: "ADD_ITEM",
  ELIMINA_ITEMS: "REMOVE_ITEM",
  ANULACION_ENDOSO: "ANNULMENT",
  ANULACION_COMPANIA: "ANNULMENT",
  CAMBIO_ASEGURADO_POLIZA: "CHANGE_PARTY",
  CAMBIO_ASEGURADO_ITEM: "CHANGE_PARTY",
  CANCELACION_COMPANIA: "CANCELLATION",
  CANCELACION_NO_PAGO: "CANCELLATION",
  CORTE_PERDIDA_TOTAL: "TOTAL_LOSS_TERMINATION",
  ENDOSO_INTERNO: "OTHER",
  MODIFICACION_GLOSA_ITEM: "MODIFY_DATA",
  MODIFICA_MONTO_PRIMA: "MODIFY_SUM_INSURED_PREMIUM",
  MODIFICACION: "MODIFY_DATA",
  PRORROGA: "EXTENSION",
  SOLICITUD_ANULACION: "ANNULMENT",
  SOLICITUD_CANCELACION: "CANCELLATION",
  REVERSO_PRORROGA: "EXTENSION_REVERSAL",
  REDUCE_VIGENCIA: "REDUCE_TERM",
  CAMBIO_COMISION: "COMMISSION_CHANGE",
  DECLARACION: "DECLARATION",
  AJUSTE_PRIMA: "PREMIUM_ADJUSTMENT",
};

const CLAUSE_TYPES = new Set<SpecEndorsementType>([
  "CANCELLATION",
  "ANNULMENT",
  "REMOVE_ITEM",
  "TOTAL_LOSS_TERMINATION",
]);

export function specEndorsementOf(appType: string): SpecEndorsement {
  const code = APP_TYPE[appType] ?? "OTHER";
  return {
    code,
    mvpEnabled: true,
    calcMethod: CALC[code],
  };
}

const SPEC_TO_APP: Record<SpecEndorsementType, string> = {
  ADD_ITEM: "AGREGA_ITEMS",
  REMOVE_ITEM: "ELIMINA_ITEMS",
  REPLACE_ITEMS: "MODIFICACION",
  MODIFY_SUM_INSURED_PREMIUM: "MODIFICA_MONTO_PRIMA",
  MODIFY_DATA: "MODIFICACION",
  CHANGE_PARTY: "CAMBIO_ASEGURADO_POLIZA",
  EXTENSION: "PRORROGA",
  CANCELLATION: "CANCELACION_COMPANIA",
  TOTAL_LOSS_TERMINATION: "CORTE_PERDIDA_TOTAL",
  ANNULMENT: "ANULACION_COMPANIA",
  REINSTATEMENT: "ENDOSO_INTERNO",
  BROKER_CHANGE: "ENDOSO_INTERNO",
  OTHER: "ENDOSO_INTERNO",
  EXTENSION_REVERSAL: "REVERSO_PRORROGA",
  REDUCE_TERM: "REDUCE_VIGENCIA",
  COMMISSION_CHANGE: "CAMBIO_COMISION",
  DECLARATION: "DECLARACION",
  PREMIUM_ADJUSTMENT: "AJUSTE_PRIMA",
};

/** Código de la especificación → tipo que guarda la póliza. */
export function appTypeForSpec(code: string): string {
  return SPEC_TO_APP[code as SpecEndorsementType] ?? "ENDOSO_INTERNO";
}

export type InalterabilityInput = {
  hasClause: boolean;
  specType: SpecEndorsementType;
  lowersSumInsured: boolean;
  removesLossPayee: boolean;
  hasCreditorAuthorization: boolean;
  canOverride: boolean;
  overrideReason: string | null;
  recordingWhatInsurerIssued: boolean;
};

export type InalterabilityResult = {
  blocked: boolean;
  code: "OK" | "CREDITOR_REQUIRED" | "REASON_REQUIRED";
  warnCreditor: boolean;
};

/** RN-161. Sin cláusula, no hay bloqueo. */
export function inalterabilityDecision(
  input: InalterabilityInput,
): InalterabilityResult {
  const affects =
    CLAUSE_TYPES.has(input.specType) ||
    (input.specType === "MODIFY_SUM_INSURED_PREMIUM" && input.lowersSumInsured) ||
    (input.specType === "CHANGE_PARTY" && input.removesLossPayee);
  if (!input.hasClause || !affects) {
    return { blocked: false, code: "OK", warnCreditor: false };
  }
  if (input.recordingWhatInsurerIssued) {
    return { blocked: false, code: "OK", warnCreditor: true };
  }
  if (input.hasCreditorAuthorization) {
    return { blocked: false, code: "OK", warnCreditor: false };
  }
  const reason = input.overrideReason?.trim() ?? "";
  if (input.canOverride && reason.length >= 10) {
    return { blocked: false, code: "OK", warnCreditor: false };
  }
  if (input.canOverride) {
    return { blocked: true, code: "REASON_REQUIRED", warnCreditor: false };
  }
  return { blocked: true, code: "CREDITOR_REQUIRED", warnCreditor: false };
}
