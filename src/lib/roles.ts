import type { AppRole } from "@/lib/permissions";
import { factoryRoleOf, hasPermission } from "@/lib/factory-roles";

/** Etiqueta legible de un rol. */
export function roleLabel(role: AppRole | string): string {
  switch (role) {
    case "admin":
    case "ADMIN":
      return "Administrador";
    case "gerente":
      return "Gerente";
    case "ejecutivo":
    case "ACCOUNT_EXECUTIVE":
      return "Ejecutivo de cuentas";
    case "COLLECTIONS":
      return "Cobranza";
    case "CLAIMS":
      return "Siniestros";
    case "FINANCE":
      return "Finanzas";
    case "READ_ONLY":
      return "Solo lectura";
    default:
      return role;
  }
}

/**
 * En el MVP todos los roles de fábrica ven la corredora completa.
 * El ejecutivo histórico queda en ese mismo alcance.
 */
export function canSeeAllClients(role: AppRole | string): boolean {
  if (role === "ejecutivo" || role === "gerente" || role === "admin") return true;
  return factoryRoleOf(role) != null;
}

function isManager(role: AppRole | string): boolean {
  return role === "gerente" || role === "admin" || role === "ADMIN";
}

export function canDeleteClient(role: AppRole | string): boolean {
  return isManager(role);
}

export function canDeleteProposal(role: AppRole | string): boolean {
  return isManager(role);
}

export function canDeletePolicy(role: AppRole | string): boolean {
  return isManager(role);
}

export function canDeleteClaim(role: AppRole | string): boolean {
  return isManager(role);
}

export function canManageMembers(role: AppRole | string): boolean {
  return role === "admin" || role === "ADMIN";
}

/**
 * Ver el reporte de comisiones, registrar pagos de la compañía y generar
 * liquidaciones de vendedores.
 */
export function canManageCommissions(role: AppRole | string): boolean {
  return hasPermission(role, "commissions.reconcile");
}

/**
 * Editar tasas de comisión de vendedores y el override por póliza.
 */
export function canEditCommissionRates(role: AppRole | string): boolean {
  return role === "admin" || role === "ADMIN";
}
