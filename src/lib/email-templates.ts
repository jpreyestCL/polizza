/**
 * Catálogo de plantillas de la especificación. El envío real de propuesta
 * y póliza sigue usando el texto que escribe la persona. Estas fichas
 * son el catálogo que esa redacción tiene que cubrir.
 */

export type EmailTemplateDef = {
  code: string;
  event: string;
  recipient: string;
};

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  { code: "QUOTE_REQUEST", event: "Solicitud de cotización a una compañía", recipient: "Contacto de cotizaciones" },
  { code: "QUOTE_REMINDER", event: "La compañía no responde", recipient: "Contacto de cotizaciones" },
  { code: "QUOTE_COMPARISON", event: "Comparativo al cliente", recipient: "Cliente" },
  { code: "PROPOSAL_TO_INSURER", event: "Envío de la propuesta", recipient: "Contacto de propuestas" },
  { code: "ENDORSEMENT_TO_INSURER", event: "Solicitud de endoso", recipient: "Contacto de propuestas" },
  { code: "ISSUANCE_CORRECTION", event: "Endoso de corrección por emisión con problemas", recipient: "Contacto de propuestas" },
  { code: "POLICY_DELIVERY", event: "Despacho de la póliza", recipient: "Cliente y acreedor" },
  { code: "ENDORSEMENT_DELIVERY", event: "Despacho del endoso", recipient: "Cliente" },
  { code: "RENEWAL_NOTICE", event: "Condiciones de renovación", recipient: "Cliente" },
  { code: "LOSS_PAYEE_NOTICE", event: "Aviso al acreedor", recipient: "Acreedor" },
  { code: "COLLECTION_ADVANCE", event: "Cuotas por vencer", recipient: "Pagador" },
  { code: "COLLECTION_OVERDUE", event: "Cuotas vencidas", recipient: "Pagador" },
  { code: "COLLECTION_REJECTED", event: "Cargo PAC/PAT rechazado", recipient: "Pagador" },
  { code: "LAPSE_NOTICE", event: "Riesgo de corte", recipient: "Pagador" },
  { code: "CANCELLATION_BALANCE", event: "Saldo de término", recipient: "Pagador" },
  { code: "CLAIM_TO_INSURER", event: "Denuncio a la compañía", recipient: "Contacto de siniestros" },
  { code: "CLAIM_TO_ADJUSTER", event: "Aviso al liquidador", recipient: "Liquidador" },
  { code: "CLAIM_ASSIGNED_TO_INSURED", event: "Número de siniestro al asegurado", recipient: "Asegurado" },
  { code: "CLAIM_ADJUSTER_FOLLOWUP", event: "Pedido de informe al liquidador", recipient: "Liquidador" },
  { code: "CLAIM_CLOSED", event: "Cierre del siniestro", recipient: "Asegurado" },
  { code: "TASK_NOTIFICATION", event: "Tarea asignada o comentada", recipient: "Usuario" },
  { code: "USER_INVITATION", event: "Invitación a Polizza", recipient: "Usuario" },
];
