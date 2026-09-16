import { describe, it, expect } from "vitest";
import {
  ENDORSEMENT_TYPES,
  ENDORSEMENT_TYPE_LABELS,
  endorsementStatusEffect,
  endorsementSchema,
} from "@/features/endorsements/schemas";

describe("tipos de endoso", () => {
  it("expone los 16 tipos operativos, cada uno con etiqueta", () => {
    expect(ENDORSEMENT_TYPES).toHaveLength(16);
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

  it("cancelaciones, corte por pérdida total y solicitud dejan la póliza CANCELADA", () => {
    expect(endorsementStatusEffect("CANCELACION_COMPANIA")).toBe("CANCELADA");
    expect(endorsementStatusEffect("CANCELACION_NO_PAGO")).toBe("CANCELADA");
    expect(endorsementStatusEffect("CORTE_PERDIDA_TOTAL")).toBe("CANCELADA");
    expect(endorsementStatusEffect("SOLICITUD_CANCELACION")).toBe("CANCELADA");
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
    ] as const) {
      expect(endorsementStatusEffect(t)).toBeNull();
    }
  });

  it("rechaza un tipo que ya no existe", () => {
    const res = endorsementSchema.safeParse({
      type: "CANCELACION",
      effectiveDate: "2026-09-15",
      reason: "",
      notes: "",
    });
    expect(res.success).toBe(false);
  });
});
