/**
 * Plantillas de siniestro de la especificación (06 §7.8).
 * El par es plazo / alerta, en días.
 */

export type ClaimWorkflowFamily = "VEHICLE" | "PROPERTY" | "PERSONS";

export type ClaimWorkflowStep = {
  action: string;
  dueDays: number | null;
  alertDays: number | null;
  alternative: string | null;
};

const VEHICLE: ClaimWorkflowStep[] = [
  { action: "Envío del denuncio a la compañía", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Respuesta de asignación", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Aviso al liquidador", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Notificación al asegurado", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Confirmación de ingreso a taller", dueDays: 10, alertDays: 5, alternative: null },
  { action: "Recepción de presupuesto", dueDays: 15, alertDays: 7, alternative: null },
  {
    action: "Orden de reparación",
    dueDays: 5,
    alertDays: 3,
    alternative: "Confirmación de pérdida total",
  },
  { action: "Informe de liquidación", dueDays: 30, alertDays: 20, alternative: null },
  { action: "Confirmación de pago", dueDays: 15, alertDays: 10, alternative: null },
  { action: "Cierre", dueDays: 5, alertDays: 5, alternative: null },
  { action: "Reapertura", dueDays: 30, alertDays: 30, alternative: null },
];

const PROPERTY: ClaimWorkflowStep[] = [
  { action: "Envío del denuncio", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Respuesta de asignación", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Aviso al liquidador", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Coordinación de inspección", dueDays: null, alertDays: null, alternative: null },
  { action: "Acta de inspección", dueDays: null, alertDays: null, alternative: null },
  { action: "Solicitud de antecedentes", dueDays: null, alertDays: null, alternative: null },
  { action: "Recepción de antecedentes", dueDays: null, alertDays: null, alternative: null },
  {
    action: "Propuesta de indemnización",
    dueDays: null,
    alertDays: null,
    alternative: "Aceptación o rechazo",
  },
  { action: "Finiquito para firma", dueDays: null, alertDays: null, alternative: null },
  { action: "Finiquito firmado a la compañía", dueDays: null, alertDays: null, alternative: null },
  { action: "Cierre", dueDays: 130, alertDays: 30, alternative: null },
];

const PERSONS: ClaimWorkflowStep[] = [
  { action: "Envío del denuncio", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Respuesta de asignación", dueDays: 1, alertDays: 1, alternative: null },
  { action: "Solicitud de antecedentes", dueDays: 5, alertDays: 3, alternative: null },
  { action: "Recepción de antecedentes", dueDays: 15, alertDays: 7, alternative: null },
  { action: "Liquidación", dueDays: 30, alertDays: 20, alternative: null },
  { action: "Pago", dueDays: 15, alertDays: 10, alternative: null },
  { action: "Cierre", dueDays: 5, alertDays: 5, alternative: null },
];

export const CLAIM_WORKFLOWS: Record<ClaimWorkflowFamily, ClaimWorkflowStep[]> = {
  VEHICLE,
  PROPERTY,
  PERSONS,
};

export function claimWorkflow(family: ClaimWorkflowFamily): ClaimWorkflowStep[] {
  return CLAIM_WORKFLOWS[family];
}

/**
 * El ramo de la corredora no trae la familia de la especificación.
 * Vehículos y SOAP usan la plantilla de vehículos; vida y accidentes, personas;
 * el resto de generales, bienes.
 */
export function claimWorkflowFamily(
  branchKey: string | null | undefined,
  category: string | null | undefined,
): ClaimWorkflowFamily | null {
  if (!branchKey && !category) return null;
  const key = branchKey ?? "";
  if (key === "vehiculos_motorizados" || key === "soap") return "VEHICLE";
  if (
    key === "vida_salud" ||
    key.startsWith("accidentes_personales") ||
    category === "VIDA_SALUD"
  ) {
    return "PERSONS";
  }
  if (category === "GENERALES" || key.length > 0) return "PROPERTY";
  return null;
}

export function claimStepDueDate(from: Date, dueDays: number | null): Date | null {
  if (dueDays == null) return null;
  const next = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  next.setUTCDate(next.getUTCDate() + dueDays);
  return next;
}
