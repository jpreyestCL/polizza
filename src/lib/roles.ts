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
