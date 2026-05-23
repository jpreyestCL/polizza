import { describe, it, expect } from "vitest";
import { clientFormSchema } from "@/features/clients/schemas";

const baseClient = {
  type: "PERSONA" as const,
  status: "PROSPECTO" as const,
  rut: "11.111.111-1",
  name: "Juan Pérez González",
  firstName: "Juan",
  lastNamePaterno: "Pérez",
  lastNameMaterno: "González",
  legalName: "",
  giro: "",
  birthDate: "",
  email: "",
  phone: "",
  celular: "",
  address: "",
  region: "",
  commune: "",
  assignedUserId: "",
  vendedor: "",
  cobranzaUserId: "",
  siniestrosUserId: "",
  holdingId: "",
  source: "",
  comentarioAlerta: "",
  observaciones: "",
  contacts: [],
};

describe("clientFormSchema", () => {
  it("acepta un prospecto solo con nombre y RUT", () => {
    expect(clientFormSchema.safeParse(baseClient).success).toBe(true);
  });

  it("rechaza un RUT inválido", () => {
    const result = clientFormSchema.safeParse({
      ...baseClient,
      rut: "11.111.111-2",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una persona sin nombres", () => {
    expect(
      clientFormSchema.safeParse({ ...baseClient, firstName: "" }).success,
    ).toBe(false);
  });

  it("rechaza una persona sin apellido paterno", () => {
    expect(
      clientFormSchema.safeParse({ ...baseClient, lastNamePaterno: "" })
        .success,
    ).toBe(false);
  });

  it("acepta una empresa solo con razón social en name", () => {
    expect(
      clientFormSchema.safeParse({
        ...baseClient,
        type: "EMPRESA",
        firstName: "",
        lastNamePaterno: "",
        lastNameMaterno: "",
        name: "Acme SpA",
      }).success,
    ).toBe(true);
  });

  it("rechaza un correo con formato inválido", () => {
    expect(
      clientFormSchema.safeParse({ ...baseClient, email: "no-es-correo" })
        .success,
    ).toBe(false);
  });

  it("acepta un correo vacío", () => {
    expect(
      clientFormSchema.safeParse({ ...baseClient, email: "" }).success,
    ).toBe(true);
  });

  it("rechaza un cliente activo sin dirección, comuna ni región", () => {
    const result = clientFormSchema.safeParse({
      ...baseClient,
      status: "ACTIVO",
    });
    expect(result.success).toBe(false);
  });

  it("acepta un cliente activo con datos de contacto completos", () => {
    const result = clientFormSchema.safeParse({
      ...baseClient,
      status: "ACTIVO",
      address: "Av. Providencia 123",
      region: "Metropolitana de Santiago",
      commune: "Providencia",
      celular: "+56 9 1234 5678",
    });
    expect(result.success).toBe(true);
  });

  it("exige nombre en cada contacto", () => {
    const result = clientFormSchema.safeParse({
      ...baseClient,
      contacts: [
        {
          name: "",
          role: "",
          email: "",
          phone: "",
          whatsapp: "",
          isPrimary: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
