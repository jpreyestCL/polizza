import type { AppRole } from "@/lib/permissions";

/** Etiqueta legible de un rol. */
export function roleLabel(role: AppRole | string): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "gerente":
      return "Gerente";
    case "ejecutivo":
      return "Ejecutivo";
    default:
      return role;
  }
}

/** Gerencia y administración ven toda la cartera; el ejecutivo solo la suya. */
export function canSeeAllClients(role: AppRole | string): boolean {
  return role === "gerente" || role === "admin";
}

export function canDeleteClient(role: AppRole | string): boolean {
  return role === "gerente" || role === "admin";
}

export function canDeleteProposal(role: AppRole | string): boolean {
  return role === "gerente" || role === "admin";
}

export function canDeletePolicy(role: AppRole | string): boolean {
  return role === "gerente" || role === "admin";
}

export function canDeleteClaim(role: AppRole | string): boolean {
  return role === "gerente" || role === "admin";
}

export function canManageMembers(role: AppRole | string): boolean {
  return role === "admin";
}

/**
 * Ver el reporte de comisiones, registrar pagos de la compañía y generar
 * liquidaciones de vendedores. Cartera global → gerencia y administración.
 */
export function canManageCommissions(role: AppRole | string): boolean {
  return role === "gerente" || role === "admin";
}

/**
 * Editar tasas de comisión de vendedores y el override por póliza. Solo el
 * administrador, porque baja porcentajes para cerrar acuerdos.
 */
export function canEditCommissionRates(role: AppRole | string): boolean {
  return role === "admin";
}
