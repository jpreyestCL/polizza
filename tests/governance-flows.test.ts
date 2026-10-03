import { describe, expect, it } from "vitest";
import {
  classifyCollectionReminder,
  localDateKey,
  reminderDedupeKey,
} from "@/features/billing/reminders";
import { dataSubjectRequestSchema } from "@/features/privacy/schemas";
import {
  complianceObligationSchema,
  complianceResolutionSchema,
} from "@/features/compliance/schemas";
import { canWriteModel } from "@/lib/domain/write-guard";

describe("recordatorios de cobranza", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  it("clasifica anticipado, vencido, rechazo y riesgo de término", () => {
    expect(classifyCollectionReminder("PENDIENTE", new Date("2026-10-08"), now)).toBe("ADVANCE");
    expect(classifyCollectionReminder("PENDIENTE", new Date("2026-10-02"), now)).toBe("OVERDUE");
    expect(classifyCollectionReminder("RECHAZADA", new Date("2026-10-20"), now)).toBe("REJECTED");
    expect(classifyCollectionReminder("PARCIAL", new Date("2026-09-01"), now)).toBe("LAPSE");
    expect(classifyCollectionReminder("PAGADA", new Date("2026-09-01"), now)).toBeNull();
  });

  it("genera una clave diaria estable en la zona de la organización", () => {
    const day = localDateKey(new Date("2026-10-03T02:00:00Z"), "America/Santiago");
    expect(day).toBe("2026-10-02");
    expect(reminderDedupeKey("i1", "OVERDUE", day)).toBe("i1:OVERDUE:2026-10-02");
  });
});

describe("privacidad y cumplimiento", () => {
  it("valida solicitudes y resoluciones con motivo", () => {
    expect(dataSubjectRequestSchema.safeParse({
      clientId: "c1",
      type: "ACCESS",
      dueAt: "2026-10-30",
    }).success).toBe(true);
    expect(complianceObligationSchema.safeParse({
      code: "CMF-1",
      title: "Reporte",
      dueDate: "2026-10-30",
    }).success).toBe(true);
    expect(complianceResolutionSchema.safeParse({
      id: "o1",
      status: "WAIVED",
      reason: "muy corto",
    }).success).toBe(false);
  });

  it("acota escrituras a sus permisos", () => {
    expect(canWriteModel("COLLECTIONS", "CollectionReminder")).toBe(true);
    expect(canWriteModel("COLLECTIONS", "DataSubjectRequest")).toBe(false);
    expect(canWriteModel("ADMIN", "DataSubjectRequest")).toBe(true);
    expect(canWriteModel("ADMIN", "ComplianceObligation")).toBe(true);
  });
});
