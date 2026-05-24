import { describe, it, expect } from "vitest";
import {
  claimIntakeSchema,
  claimDetailsSchema,
  claimThirdPartySchema,
  isVehicleBranch,
} from "@/features/claims/schemas";

describe("claimIntakeSchema", () => {
  const base = {
    clientId: "client-1",
    policyId: "policy-1",
    policyItemId: "item-1",
    proposalItemId: "",
    branchTypeId: "branch-1",
    description: "Choque en estacionamiento, parachoques trasero",
  };

  it("acepta un denuncio válido", () => {
    expect(claimIntakeSchema.safeParse(base).success).toBe(true);
  });

  it("exige póliza", () => {
    expect(
      claimIntakeSchema.safeParse({ ...base, policyId: "" }).success,
    ).toBe(false);
  });

  it("exige descripción", () => {
    expect(
      claimIntakeSchema.safeParse({ ...base, description: "" }).success,
    ).toBe(false);
  });
});

describe("claimDetailsSchema", () => {
  const base = {
    entryParty: "",
    entryChannel: "",
    reportedAtBroker: "",
    reporterRut: "",
    reporterFirstName: "",
    reporterLastName: "",
    reporterPhone: "",
    reporterEmail: "",
    occurredAt: "",
    occurredAtTime: "",
    mainCoverageAffected: "",
    policeReportDate: "",
    policeStation: "",
    policeReportFolio: "",
    incidentCause: "",
    incidentAddress: "",
    incidentCommune: "",
    incidentCity: "",
    incidentNarrative: "",
    lossType: "",
    smartDeductible: "",
    hasAlcoholTest: "",
    driverAtFault: "",
    driverFirstName: "",
    driverLastName: "",
    driverRut: "",
    driverAge: "",
    estimatedAmount: "",
    settledAmount: "",
    currency: "UF" as const,
    assignedUserId: "",
    description: "Denuncio en revisión",
  };

  it("acepta valores válidos", () => {
    expect(claimDetailsSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza un monto negativo", () => {
    expect(
      claimDetailsSchema.safeParse({ ...base, estimatedAmount: "-5" }).success,
    ).toBe(false);
  });

  it("rechaza un email inválido", () => {
    expect(
      claimDetailsSchema.safeParse({ ...base, reporterEmail: "no-es-email" })
        .success,
    ).toBe(false);
  });

  it("acepta un email vacío", () => {
    expect(
      claimDetailsSchema.safeParse({ ...base, reporterEmail: "" }).success,
    ).toBe(true);
  });

  it("rechaza una edad no numérica", () => {
    expect(
      claimDetailsSchema.safeParse({ ...base, driverAge: "abc" }).success,
    ).toBe(false);
  });
});

describe("claimThirdPartySchema", () => {
  it("acepta tercero vacío con vehículo", () => {
    expect(
      claimThirdPartySchema.safeParse({ involvesVehicle: true }).success,
    ).toBe(true);
  });
});

describe("isVehicleBranch", () => {
  it("detecta ramos de vehículos", () => {
    expect(isVehicleBranch("vehiculos")).toBe(true);
    expect(isVehicleBranch("soap")).toBe(true);
    expect(isVehicleBranch("equipo_movil_individualizado")).toBe(true);
  });
  it("descarta otros ramos", () => {
    expect(isVehicleBranch("incendio")).toBe(false);
    expect(isVehicleBranch(null)).toBe(false);
  });
});
