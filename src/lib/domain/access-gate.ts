/** El segundo factor solo se pide si la corredora lo exige. */

export function secondFactorStep(input: {
  mfaRequired: boolean;
  enrolled: boolean;
}): "app" | "totp" | "enroll" {
  if (!input.mfaRequired) return "app";
  return input.enrolled ? "totp" : "enroll";
}

/**
 * SSO no apaga la contraseña. Si no hay credenciales del proveedor,
 * el ingreso por correo sigue disponible.
 */
export function ssoButtonVisible(input: {
  ssoEnabled: boolean;
  providerConfigured: boolean;
}): boolean {
  return input.ssoEnabled && input.providerConfigured;
}
