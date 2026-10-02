import { describe, expect, it } from "vitest";
import { canMoveQuote, quoteNeedsOffer } from "@/lib/domain/quote-flow";
import { nextDispatchStatus } from "@/lib/domain/dispatch-flow";
import { sensitiveReasonError } from "@/lib/domain/sensitive-reason";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";

describe("flujos que faltaban", () => {
  it("la cotización avanza hasta ganada o perdida y no salta estados", () => {
    expect(canMoveQuote("BORRADOR", "SOLICITADA")).toBe(true);
    expect(canMoveQuote("BORRADOR", "GANADA")).toBe(false);
    expect(canMoveQuote("ENVIADA_CLIENTE", "GANADA")).toBe(true);
    expect(canMoveQuote("ENVIADA_CLIENTE", "PERDIDA")).toBe(true);
    expect(canMoveQuote("GANADA", "BORRADOR")).toBe(false);
    expect(quoteNeedsOffer("COTIZADA")).toBe(true);
    expect(quoteNeedsOffer("SOLICITADA")).toBe(false);
  });

  it("el despacho nace pendiente y pasa a enviado una sola vez", () => {
    expect(nextDispatchStatus(null, "queue")).toBe("PENDIENTE");
    expect(nextDispatchStatus("PENDIENTE", "queue")).toBeNull();
    expect(nextDispatchStatus("PENDIENTE", "send")).toBe("ENVIADO");
    expect(nextDispatchStatus("ENVIADO", "send")).toBeNull();
  });

  it("una acción sensible exige un motivo de 10 caracteres", () => {
    expect(sensitiveReasonError("corto")).toMatch(/10/);
    expect(sensitiveReasonError("motivo suficiente")).toBeNull();
  });

  it("el catálogo de correos trae los eventos de cobranza y despacho", () => {
    const codes = EMAIL_TEMPLATES.map((template) => template.code);
    expect(codes).toContain("POLICY_DELIVERY");
    expect(codes).toContain("COLLECTION_OVERDUE");
    expect(codes).toContain("CANCELLATION_BALANCE");
  });
});
