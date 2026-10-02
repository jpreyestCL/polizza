/**
 * Seis roles de fábrica. El alcance de datos del MVP es toda la corredora.
 * "Gerente" no es un rol de fábrica: el gerente que ya existe se trata como
 * administrador para no dejar la corredora piloto sin permisos.
 */

export const FACTORY_ROLES = [
  "ADMIN",
  "ACCOUNT_EXECUTIVE",
  "COLLECTIONS",
  "CLAIMS",
  "FINANCE",
  "READ_ONLY",
] as const;

export type FactoryRole = (typeof FACTORY_ROLES)[number];

export type PermissionDef = {
  code: string;
  module: string;
  sensitive: boolean;
  description: string;
};

export const PERMISSIONS: PermissionDef[] = [
  { code: "parties.read", module: "parties", sensitive: false, description: "Ver clientes" },
  { code: "parties.write", module: "parties", sensitive: false, description: "Crear y editar clientes" },
  { code: "parties.merge", module: "parties", sensitive: true, description: "Fusionar clientes" },
  { code: "parties.export", module: "parties", sensitive: false, description: "Exportar clientes" },
  { code: "parties.read_sensitive", module: "parties", sensitive: false, description: "Ver datos sensibles sin enmascarar" },
  { code: "privacy.manage", module: "privacy", sensitive: true, description: "Atender derechos del titular" },
  { code: "quotes.read", module: "quotes", sensitive: false, description: "Ver cotizaciones" },
  { code: "quotes.write", module: "quotes", sensitive: false, description: "Crear cotizaciones" },
  { code: "quotes.send", module: "quotes", sensitive: false, description: "Enviar cotizaciones" },
  { code: "policies.read", module: "policies", sensitive: false, description: "Ver pólizas" },
  { code: "policies.write", module: "policies", sensitive: false, description: "Crear y editar propuestas" },
  { code: "policies.send", module: "policies", sensitive: false, description: "Enviar propuestas" },
  { code: "policies.issue", module: "policies", sensitive: false, description: "Recepcionar pólizas" },
  { code: "policies.discard", module: "policies", sensitive: false, description: "Descartar propuestas" },
  { code: "policies.reopen", module: "policies", sensitive: true, description: "Reabrir una propuesta enviada o la recepción" },
  { code: "policies.edit_issued", module: "policies", sensitive: true, description: "Corregir una póliza emitida" },
  { code: "policies.force_status", module: "policies", sensitive: true, description: "Forzar el estado" },
  { code: "policies.change_number", module: "policies", sensitive: true, description: "Cambiar el número de póliza emitida" },
  { code: "endorsements.write", module: "endorsements", sensitive: false, description: "Crear endosos" },
  { code: "endorsements.issue", module: "endorsements", sensitive: false, description: "Emitir endosos" },
  { code: "endorsements.issue_nonpayment_cancellation", module: "endorsements", sensitive: false, description: "Cancelar por no pago" },
  { code: "endorsements.override_inalterability", module: "endorsements", sensitive: true, description: "Omitir la autorización del acreedor" },
  { code: "renewals.manage", module: "renewals", sensitive: false, description: "Renovar y marcar no renovación" },
  { code: "renewals.bulk", module: "renewals", sensitive: true, description: "Renovación masiva" },
  { code: "dispatch.manage", module: "dispatch", sensitive: false, description: "Despachar" },
  { code: "collections.read", module: "collections", sensitive: false, description: "Ver cobranza" },
  { code: "installments.mark_paid", module: "installments", sensitive: false, description: "Marcar cuotas pagadas" },
  { code: "collections.send_reminders", module: "collections", sensitive: false, description: "Enviar recordatorios" },
  { code: "payments.no_plan", module: "payments", sensitive: true, description: "Emitir con prima sin plan de pago" },
  { code: "installments.edit_paid", module: "installments", sensitive: true, description: "Editar o revertir una cuota pagada" },
  { code: "installments.write_off", module: "installments", sensitive: true, description: "Castigar una cuota incobrable" },
  { code: "commissions.read", module: "commissions", sensitive: false, description: "Ver comisiones" },
  { code: "commissions.reconcile", module: "commissions", sensitive: false, description: "Conciliar comisiones" },
  { code: "commissions.accept_difference", module: "commissions", sensitive: true, description: "Aceptar diferencia de comisión" },
  { code: "commissions.reopen", module: "commissions", sensitive: true, description: "Reabrir una comisión conciliada" },
  { code: "commissions.delete_payment", module: "commissions", sensitive: true, description: "Eliminar un renglón de liquidación" },
  { code: "claims.read", module: "claims", sensitive: false, description: "Ver siniestros" },
  { code: "claims.write", module: "claims", sensitive: false, description: "Registrar siniestros" },
  { code: "claims.close", module: "claims", sensitive: false, description: "Cerrar siniestros" },
  { code: "claims.reopen", module: "claims", sensitive: true, description: "Reabrir siniestros" },
  { code: "claims.edit_closed", module: "claims", sensitive: true, description: "Editar siniestros cerrados" },
  { code: "claims.void", module: "claims", sensitive: true, description: "Anular siniestros" },
  { code: "documents.read_confidential", module: "documents", sensitive: false, description: "Ver documentos confidenciales" },
  { code: "documents.delete", module: "documents", sensitive: true, description: "Eliminar documentos" },
  { code: "tasks.manage_all", module: "tasks", sensitive: false, description: "Ver y reasignar tareas de todos" },
  { code: "reports.production", module: "reports", sensitive: false, description: "Informe de producción" },
  { code: "reports.portfolio", module: "reports", sensitive: false, description: "Informe de cartera" },
  { code: "reports.commissions", module: "reports", sensitive: false, description: "Informe de comisiones" },
  { code: "reports.export", module: "reports", sensitive: false, description: "Exportar informes" },
  { code: "imports.run", module: "imports", sensitive: false, description: "Importar archivos" },
  { code: "imports.revert", module: "imports", sensitive: true, description: "Revertir un lote de importación" },
  { code: "ai.extract", module: "ai", sensitive: false, description: "Extraer datos de PDF" },
  { code: "catalog.manage", module: "catalog", sensitive: false, description: "Administrar catálogos" },
  { code: "templates.manage", module: "templates", sensitive: false, description: "Administrar plantillas" },
  { code: "users.manage", module: "users", sensitive: false, description: "Administrar usuarios" },
  { code: "roles.manage", module: "roles", sensitive: false, description: "Administrar roles" },
  { code: "settings.manage", module: "settings", sensitive: false, description: "Administrar parámetros" },
  { code: "audit.read", module: "audit", sensitive: false, description: "Ver auditoría" },
  { code: "compliance.manage", module: "compliance", sensitive: false, description: "Obligaciones de la corredora" },
];

const ALL = PERMISSIONS.map((permission) => permission.code);

const ACCOUNT_EXECUTIVE = [
  "parties.read",
  "parties.write",
  "quotes.read",
  "quotes.write",
  "quotes.send",
  "policies.read",
  "policies.write",
  "policies.send",
  "policies.issue",
  "policies.discard",
  "endorsements.write",
  "endorsements.issue",
  "endorsements.issue_nonpayment_cancellation",
  "renewals.manage",
  "dispatch.manage",
  "collections.read",
  "installments.mark_paid",
  "collections.send_reminders",
  "payments.no_plan",
  "claims.read",
  "claims.write",
  "reports.production",
  "reports.portfolio",
  "reports.export",
  "imports.run",
  "ai.extract",
];

const COLLECTIONS = [
  "parties.read",
  "parties.write",
  "policies.read",
  "claims.read",
  "collections.read",
  "installments.mark_paid",
  "collections.send_reminders",
  "installments.edit_paid",
  "installments.write_off",
  "endorsements.issue_nonpayment_cancellation",
  "dispatch.manage",
  "reports.production",
  "reports.portfolio",
  "reports.export",
  "imports.run",
  "ai.extract",
];

const CLAIMS = [
  "parties.read",
  "parties.write",
  "parties.read_sensitive",
  "policies.read",
  "claims.read",
  "claims.write",
  "claims.close",
  "claims.reopen",
  "claims.edit_closed",
  "documents.read_confidential",
  "reports.production",
  "reports.portfolio",
  "reports.export",
  "ai.extract",
];

const FINANCE = [
  "parties.read",
  "policies.read",
  "claims.read",
  "collections.read",
  "commissions.read",
  "commissions.reconcile",
  "commissions.accept_difference",
  "commissions.reopen",
  "commissions.delete_payment",
  "reports.production",
  "reports.portfolio",
  "reports.commissions",
  "reports.export",
  "imports.run",
  "ai.extract",
];

const READ_ONLY = [
  "parties.read",
  "policies.read",
  "claims.read",
  "collections.read",
  "reports.production",
  "reports.portfolio",
  "reports.commissions",
];

export const ROLE_PERMISSIONS: Record<FactoryRole, readonly string[]> = {
  ADMIN: ALL,
  ACCOUNT_EXECUTIVE,
  COLLECTIONS,
  CLAIMS,
  FINANCE,
  READ_ONLY,
};

/** El gerente histórico queda con los permisos de administrador. */
export function factoryRoleOf(role: string): FactoryRole | null {
  switch (role) {
    case "admin":
    case "gerente":
    case "ADMIN":
      return "ADMIN";
    case "ejecutivo":
    case "ACCOUNT_EXECUTIVE":
      return "ACCOUNT_EXECUTIVE";
    case "COLLECTIONS":
    case "CLAIMS":
    case "FINANCE":
    case "READ_ONLY":
      return role;
    default:
      return null;
  }
}

export function hasPermission(role: string, code: string): boolean {
  const factory = factoryRoleOf(role);
  if (!factory) return false;
  return ROLE_PERMISSIONS[factory].includes(code);
}
