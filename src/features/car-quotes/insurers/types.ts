import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Datos de entrada para una cotización en una aseguradora. Es el mismo
 * payload para todos los adaptadores: cada uno se encarga de mapearlo al
 * formato de su portal.
 */
export type QuotationInput = {
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  tipoVehiculo: string | null;
  motorizacion: string | null;
  vehicleCondition: "NUEVO" | "USADO";
  vehicleUse: "PARTICULAR" | "COMERCIAL";
  civilLiabilityUf: 500 | 1000 | 1500 | 2000;
  workshopType: "EXCLUSIVIDAD" | "MARCA";
  /** Deducibles seleccionados en UF; vacío significa "cotizar todos". */
  deductiblesUf: number[];
  client: {
    rut: string;
    name: string;
    birthDate: Date | null;
  };
};

/** Resultado parseado de una cotización emitida por una aseguradora. */
export type InsurerQuoteResult = {
  premiumUf: number;
  deductibleUf: number;
  planName: string;
  coverageDetail: Prisma.InputJsonValue;
  rawData: Prisma.InputJsonValue;
  pdf: Buffer;
};

/** Credencial resuelta y desencriptada para un portal. */
export type ResolvedCredential = {
  username: string;
  password: string;
};

/** Contrato común que cumple cada módulo por aseguradora. */
export type InsurerAdapter = {
  key: string;
  name: string;
  /** Si el adaptador real necesita credenciales del portal. El simulado no. */
  requiresCredentials: boolean;
  quote(
    input: QuotationInput,
    credential: ResolvedCredential | null,
  ): Promise<InsurerQuoteResult>;
};
