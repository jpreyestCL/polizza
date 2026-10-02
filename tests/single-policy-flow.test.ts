import { describe, expect, it } from "vitest";
import { parseCommissionLines } from "@/lib/domain/commission-lines";
import {
  appTypeForSpec,
  specEndorsementOf,
} from "@/lib/domain/endorsement-catalog";
import {
  isPreIssuePolicy,
  specStateOfPolicy,
} from "@/lib/domain/policy-lifecycle";
import { deriveRenewalStatus } from "@/lib/domain/renewal-status";
import { successorState } from "@/lib/domain/successor";
import { translateBrokerisPaste } from "@/lib/domain/brokeris-translate";
import { nonRenewalReasonLabel } from "@/features/policies/schemas";

describe("una sola póliza", () => {
  it("traduce los estados previos a la emisión", () => {
    expect(specStateOfPolicy("BORRADOR")).toBe("DRAFT");
    expect(specStateOfPolicy("ENVIADA")).toBe("SENT_TO_INSURER");
    expect(specStateOfPolicy("POR_DESPACHAR")).toBe("ISSUED");
    expect(specStateOfPolicy("RECHAZADA")).toBe("REJECTED_BY_INSURER");
    expect(specStateOfPolicy("DESCARTADA")).toBe("DISCARDED");
    expect(isPreIssuePolicy("BORRADOR")).toBe(true);
    expect(isPreIssuePolicy("VIGENTE")).toBe(false);
  });

  it("no mete un borrador en la cola de renovación", () => {
    expect(
      deriveRenewalStatus({
        policyStatus: "BORRADOR",
        endDate: new Date("2026-01-01"),
        notRenewable: false,
        nonRenewalRecorded: false,
        successor: "NONE",
      }),
    ).toBe("NOT_DUE");
  });

  it("trata la sucesora en elaboración como gestión y la rechazada como perdida", () => {
    expect(
      successorState({ childStatuses: ["BORRADOR"], proposalStatuses: [] }),
    ).toBe("IN_PROGRESS");
    expect(
      successorState({ childStatuses: ["RECHAZADA"], proposalStatuses: [] }),
    ).toBe("LOST");
    expect(
      successorState({ childStatuses: ["VIGENTE"], proposalStatuses: [] }),
    ).toBe("ISSUED");
    expect(
      successorState({ childStatuses: ["POR_DESPACHAR"], proposalStatuses: [] }),
    ).toBe("IN_PROGRESS");
  });
});

describe("endoso completo", () => {
  it("enciende los cinco tipos que estaban apagados", () => {
    for (const type of [
      "REVERSO_PRORROGA",
      "REDUCE_VIGENCIA",
      "CAMBIO_COMISION",
      "DECLARACION",
      "AJUSTE_PRIMA",
    ]) {
      expect(specEndorsementOf(type).mvpEnabled).toBe(true);
    }
    expect(specEndorsementOf("REDUCE_VIGENCIA").calcMethod).toBe("REFUND_PRORATA");
    expect(specEndorsementOf("DECLARACION").calcMethod).toBe("NONE");
    expect(appTypeForSpec("PREMIUM_ADJUSTMENT")).toBe("AJUSTE_PRIMA");
    expect(appTypeForSpec("TOTAL_LOSS_TERMINATION")).toBe("CORTE_PERDIDA_TOTAL");
  });
});

describe("comisión y no renovación", () => {
  it("lee texto, punto y coma y un encabezado", () => {
    expect(parseCommissionLines("POL-100 12,5\nPOL-200;4")).toEqual([
      { policyNumber: "POL-100", amount: 12.5 },
      { policyNumber: "POL-200", amount: 4 },
    ]);
    expect(parseCommissionLines("póliza;monto\nPOL-1;1")).toEqual([
      { policyNumber: "POL-1", amount: 1 },
    ]);
  });

  it("nombra los 23 motivos y sigue leyendo uno viejo", () => {
    expect(nonRenewalReasonLabel("PRICE")).toBe("Precio");
    expect(nonRenewalReasonLabel("PRECIO")).toBe("Precio");
    expect(nonRenewalReasonLabel("TOTAL_LOSS")).toBe("Pérdida total");
  });
});

describe("migración con columnas extra", () => {
  it("guarda el RUT y la prima sin cambiar el estado traducido", () => {
    const [row] = translateBrokerisPaste(
      "POLIZAS",
      "pol-1\t4\t0\t\t01-01-2026\tPOL-100\t12.345.678-5\tAna Pérez\t10,5\tUF\t2026-01-01\t2027-01-01\tHDI",
    );
    expect(row?.action).toBe("TRADUCIDO");
    expect(row?.payload).toMatchObject({
      policyNumber: "POL-100",
      clientRut: "12.345.678-5",
      clientName: "Ana Pérez",
      premium: "10,5",
      companyName: "HDI",
      status: "ISSUED",
    });
  });

  it("deja el endoso y el siniestro con la póliza a la que pertenecen", () => {
    const [endorsement] = translateBrokerisPaste(
      "ENDOSOS",
      "e1\t12\tPOL-100\t2026-06-01\t1,5\tSube el monto",
    );
    expect(endorsement?.payload).toMatchObject({
      code: "MODIFY_SUM_INSURED_PREMIUM",
      policyNumber: "POL-100",
      premiumDelta: "1,5",
    });
    const [claim] = translateBrokerisPaste(
      "SINIESTROS",
      "s1\t5\t9\t1\tPOL-100\tChoque",
    );
    expect(claim?.payload).toMatchObject({
      status: "CLOSED",
      policyNumber: "POL-100",
      description: "Choque",
    });
  });
});
