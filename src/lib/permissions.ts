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

const readClients = { client: ["read", "readAll"] } as const;
const writeClients = {
  client: ["create", "read", "readAll", "update", "export"],
} as const;

/**
 * Seis roles de fábrica (`@/lib/factory-roles`). Better Auth los conoce
 * para invitar y cambiar de rol; el permiso fino de cada acción lo decide
 * `hasPermission`.
 */
export const ADMIN = ac.newRole({
  ...adminAc.statements,
  client: ["create", "read", "readAll", "update", "delete", "export"],
});
export const ACCOUNT_EXECUTIVE = ac.newRole(writeClients);
export const COLLECTIONS = ac.newRole(writeClients);
export const CLAIMS = ac.newRole(writeClients);
export const FINANCE = ac.newRole(readClients);
export const READ_ONLY = ac.newRole(readClients);

export const roles = {
  ejecutivo,
  gerente,
  admin,
  ADMIN,
  ACCOUNT_EXECUTIVE,
  COLLECTIONS,
  CLAIMS,
  FINANCE,
  READ_ONLY,
};

export type AppRole = keyof typeof roles;
export const APP_ROLES = [
  "ejecutivo",
  "gerente",
  "admin",
  "ADMIN",
  "ACCOUNT_EXECUTIVE",
  "COLLECTIONS",
  "CLAIMS",
  "FINANCE",
  "READ_ONLY",
] as const;
