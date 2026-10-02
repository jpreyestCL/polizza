import { describe, it, expect } from "vitest";
import {
  ENDORSEMENT_TYPES,
  ENDORSEMENT_TYPE_LABELS,
  endorsementStatusEffect,
  endorsementSchema,
  endorsementTransitionError,
  endorsementUsesCalculatedCredit,
  parsePremiumDelta,
} from "@/features/endorsements/schemas";

describe("tipos de endoso", () => {
  it("expone los 24 tipos operativos, cada uno con etiqueta", () => {
    expect(ENDORSEMENT_TYPES).toHaveLength(24);
    for (const type of [
      "REEMPLAZA_ITEMS",
      "REHABILITACION",
      "CAMBIO_CORREDOR",
      "REVERSO_PRORROGA",
      "REDUCE_VIGENCIA",
      "CAMBIO_COMISION",
      "DECLARACION",
      "AJUSTE_PRIMA",
    ] as const) {
      expect(ENDORSEMENT_TYPES).toContain(type);
    }
    for (const t of ENDORSEMENT_TYPES) {
      expect(ENDORSEMENT_TYPE_LABELS[t]).toBeTruthy();
    }
  });

  // Tabla de la planilla "cambio de estados endosos" (corredora, 2026-09-16).
  it("anulaciones y solicitud de anulación dejan la póliza ANULADA", () => {
    expect(endorsementStatusEffect("ANULACION_ENDOSO")).toBe("ANULADA");
    expect(endorsementStatusEffect("ANULACION_COMPANIA")).toBe("ANULADA");
    expect(endorsementStatusEffect("SOLICITUD_ANULACION")).toBe("ANULADA");
  });

  it("las cancelaciones dejan la póliza CANCELADA y la pérdida total no la cancela sola", () => {
    expect(endorsementStatusEffect("CANCELACION_COMPANIA")).toBe("CANCELADA");
    expect(endorsementStatusEffect("CANCELACION_NO_PAGO")).toBe("CANCELADA");
    expect(endorsementStatusEffect("SOLICITUD_CANCELACION")).toBe("CANCELADA");
    expect(endorsementStatusEffect("CORTE_PERDIDA_TOTAL")).toBeNull();
  });

  it("los endosos de ítems, glosa, monto y prórroga solo quedan en bitácora", () => {
    for (const t of [
      "AGREGA_ITEMS",
      "ELIMINA_ITEMS",
      "CAMBIO_ASEGURADO_POLIZA",
      "CAMBIO_ASEGURADO_ITEM",
      "ENDOSO_INTERNO",
      "MODIFICACION_GLOSA_ITEM",
      "MODIFICA_MONTO_PRIMA",
      "MODIFICACION",
      "PRORROGA",
      "REVERSO_PRORROGA",
      "REDUCE_VIGENCIA",
      "CAMBIO_COMISION",
      "DECLARACION",
      "AJUSTE_PRIMA",
    ] as const) {
      expect(endorsementStatusEffect(t)).toBeNull();
    }
  });

  it("rechaza un tipo que ya no existe", () => {
    const res = endorsementSchema.safeParse({
      type: "CANCELACION",
      effectiveDate: "2026-09-15",
      notes: "",
    });
    expect(res.success).toBe(false);
  });
});

describe("formulario de endoso", () => {
  it("no pide motivo: basta el tipo y el detalle", () => {
    const res = endorsementSchema.safeParse({
      type: "MODIFICACION",
      effectiveDate: "2026-09-23",
      detail: "Se incluye la cobertura de remoción de escombros",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.mode).toBe("PROPUESTA");
  });

  it("la propuesta de endoso exige el detalle para la compañía", () => {
    const res = endorsementSchema.safeParse({
      mode: "PROPUESTA",
      type: "MODIFICACION",
      effectiveDate: "2026-09-23",
    });
    expect(res.success).toBe(false);
  });

  it("acepta un delta de prima con signo", () => {
    const res = endorsementSchema.safeParse({
      mode: "DIRECTO",
      type: "MODIFICA_MONTO_PRIMA",
      effectiveDate: "2026-09-23",
      premiumAffectedDelta: "-4,5",
      premiumExemptDelta: "1.25",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(parsePremiumDelta(res.data.premiumAffectedDelta)).toBe(-4.5);
      expect(parsePremiumDelta(res.data.premiumExemptDelta)).toBe(1.25);
    }
  });

  it("el crédito de cancelación se calcula; el corte por pérdida total no", () => {
    expect(endorsementUsesCalculatedCredit("CANCELACION_COMPANIA")).toBe(true);
    expect(endorsementUsesCalculatedCredit("CORTE_PERDIDA_TOTAL")).toBe(false);
    expect(endorsementUsesCalculatedCredit("MODIFICA_MONTO_PRIMA")).toBe(false);
  });

  it("el registro directo no exige detalle", () => {
    const res = endorsementSchema.safeParse({
      mode: "DIRECTO",
      type: "CANCELACION_NO_PAGO",
      effectiveDate: "2026-09-23",
    });
    expect(res.success).toBe(true);
  });

  it("rechaza un fin de endoso anterior al inicio", () => {
    const res = endorsementSchema.safeParse({
      mode: "DIRECTO",
      type: "PRORROGA",
      effectiveDate: "2026-09-23",
      endDate: "2026-09-01",
    });
    expect(res.success).toBe(false);
  });
});

describe("endorsementTransitionError", () => {
  it("no deja cancelar una póliza ya anulada", () => {
    expect(
      endorsementTransitionError("CANCELACION_COMPANIA", "ANULADA"),
    ).toBeTruthy();
  });

  it("no deja anular dos veces", () => {
    expect(endorsementTransitionError("ANULACION_COMPANIA", "ANULADA")).toBeTruthy();
  });

  it("solo se rehabilita una póliza cancelada o anulada", () => {
    expect(endorsementTransitionError("REHABILITACION", "VIGENTE")).toBeTruthy();
    expect(endorsementTransitionError("REHABILITACION", "CANCELADA")).toBeNull();
    expect(endorsementTransitionError("REHABILITACION", "ANULADA")).toBeNull();
  });

  it("los endosos que no mueven el estado se aplican siempre", () => {
    expect(endorsementTransitionError("MODIFICACION", "CANCELADA")).toBeNull();
    expect(endorsementTransitionError("CANCELACION_NO_PAGO", "VIGENTE")).toBeNull();
  });
});

describe("catálogo de la especificación", () => {
  it("rehabilitación, cambio de corredor y reemplazo tienen tipo propio", async () => {
    const { appTypeForSpec, specEndorsementOf } = await import(
      "@/lib/domain/endorsement-catalog"
    );
    expect(appTypeForSpec("REINSTATEMENT")).toBe("REHABILITACION");
    expect(appTypeForSpec("BROKER_CHANGE")).toBe("CAMBIO_CORREDOR");
    expect(appTypeForSpec("REPLACE_ITEMS")).toBe("REEMPLAZA_ITEMS");
    expect(specEndorsementOf("REHABILITACION").code).toBe("REINSTATEMENT");
    expect(specEndorsementOf("CAMBIO_CORREDOR").code).toBe("BROKER_CHANGE");
  });
});

describe("recepción del endoso emitido", () => {
  it("acepta el inicio de vigencia del endoso emitido (opcional)", async () => {
    const { policyReceptionSchema } = await import(
      "@/features/proposals/schemas"
    );
    const base = {
      policyNumber: "053",
      emissionDate: "2026-09-25",
      receptionDate: "2026-09-26",
    };
    expect(policyReceptionSchema.parse(base).effectiveDate).toBe("");
    expect(
      policyReceptionSchema.parse({ ...base, effectiveDate: "2026-09-23" })
        .effectiveDate,
    ).toBe("2026-09-23");
  });
});
