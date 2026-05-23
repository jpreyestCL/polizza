import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
} from "better-auth/plugins/organization/access";

/**
 * Control de acceso de Polizza. Extiende los permisos de organización de
 * Better Auth con el recurso `client` (Clientes 360°).
 */
export const statement = {
  ...defaultStatements,
  client: ["create", "read", "readAll", "update", "delete", "export"],
} as const;

export const ac = createAccessControl(statement);

/** Ejecutivo: gestiona su propia cartera. */
export const ejecutivo = ac.newRole({
  client: ["create", "read", "update", "export"],
});

/** Gerente: ve y gestiona toda la cartera de la corredora. */
export const gerente = ac.newRole({
  client: ["create", "read", "readAll", "update", "delete", "export"],
});

/** Administrador: gerente + configuración y gestión de usuarios. */
export const admin = ac.newRole({
  ...adminAc.statements,
  client: ["create", "read", "readAll", "update", "delete", "export"],
});

export const roles = { ejecutivo, gerente, admin };

export type AppRole = keyof typeof roles;
export const APP_ROLES = ["ejecutivo", "gerente", "admin"] as const;
