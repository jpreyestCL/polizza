/** Módulos contratados. El MVP enciende extracción y cotización comparativa. */

export const TENANT_FEATURE_CODES = [
  "AI_EXTRACTION",
  "QUOTE_COMPARATOR",
  "INBOUND_EMAIL",
  "COLLECTIONS_AUTO_EMAIL",
  "AI_ASSISTANT",
  "COMMISSION_AGENTS",
  "CLIENT_PORTAL",
  "CASH_RECEIPTS",
  "WHATSAPP_API",
] as const;

export type TenantFeatureCode = (typeof TENANT_FEATURE_CODES)[number];

export const DEFAULT_TENANT_FEATURES: Record<TenantFeatureCode, boolean> = {
  AI_EXTRACTION: true,
  QUOTE_COMPARATOR: true,
  INBOUND_EMAIL: false,
  COLLECTIONS_AUTO_EMAIL: false,
  AI_ASSISTANT: false,
  COMMISSION_AGENTS: false,
  CLIENT_PORTAL: false,
  CASH_RECEIPTS: false,
  WHATSAPP_API: false,
};

export function isKnownFeature(code: string): code is TenantFeatureCode {
  return (TENANT_FEATURE_CODES as readonly string[]).includes(code);
}
