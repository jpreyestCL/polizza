import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { EndorsementType } from "@prisma/client";
import { basePrisma, getDb } from "@/server/db";
import { setTenantGuc } from "@/server/tenant-rls";
import {
  activeTerminations,
  applyEndorsementToPolicy,
  deleteEndorsementInTx,
} from "@/features/endorsements/apply";

const org = `test-endoso-${Date.now()}`;
const db = getDb(org);
const user = { organizationId: org, userId: "test-user" };
let policyId = "";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function inTx<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await setTenantGuc(tx as never, org);
    return fn(tx);
  });
}

async function apply(type: EndorsementType, effective = "2026-06-01") {
  // Los endosos se ordenan por createdAt: dos seguidos no deben empatar.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const result = await inTx((tx) =>
    applyEndorsementToPolicy(tx, {
      ...user,
      policyId,
      type,
      effectiveDate: day(effective),
      endDate: null,
      endorsementNumber: null,
      detail: null,
      notes: null,
      proposalId: null,
    }),
  );
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

async function remove(id: string) {
  const endorsement = await db.endorsement.findFirstOrThrow({
    where: { id },
    select: {
      id: true,
      policyId: true,
      type: true,
      createdAt: true,
      priorSnapshot: true,
    },
  });
  await inTx((tx) => deleteEndorsementInTx(tx, endorsement, user));
}

async function state() {
  const policy = await db.policy.findFirstOrThrow({
    where: { id: policyId },
    select: { status: true, terminationBalance: true },
  });
  const movements = await db.premiumMovement.findMany({
    where: { policyId },
    select: { premiumAffected: true, premiumExempt: true },
  });
  const ledger = movements.reduce(
    (sum, row) => sum + Number(row.premiumAffected) + Number(row.premiumExempt),
    0,
  );
  return {
    status: policy.status,
    hasBalance: policy.terminationBalance != null,
    ledger: Math.round(ledger * 10_000) / 10_000,
  };
}

describe("endosos de término contra la base", () => {
  beforeEach(async () => {
    const client = await db.client.create({
      data: { organizationId: org, rut: `${Date.now()}-K`, name: "Asegurado" },
    });
    const policy = await db.policy.create({
      data: {
        organizationId: org,
        clientId: client.id,
        policyNumber: `POL-${Date.now()}`,
        status: "VIGENTE",
        currency: "UF",
        premiumNet: 120,
        premiumAffect: 120,
        startDate: day("2026-01-01"),
        endDate: day("2027-01-01"),
      },
    });
    policyId = policy.id;
  });

  afterAll(async () => {
    await basePrisma.policy.deleteMany({ where: { organizationId: org } });
    await basePrisma.client.deleteMany({ where: { organizationId: org } });
    await basePrisma.$disconnect();
  });

  it("borrar la rehabilitación vuelve a cancelar y borrar la cancelación deja todo como antes", async () => {
    const cancel = await apply("SOLICITUD_CANCELACION");
    const cancelled = await state();
    expect(cancelled.status).toBe("CANCELADA");
    expect(cancelled.hasBalance).toBe(true);
    expect(cancelled.ledger).toBeLessThan(120);

    const rehab = await apply("REHABILITACION");
    expect(await state()).toEqual({ status: "VIGENTE", hasBalance: false, ledger: 120 });
    expect(await activeTerminations(db, policyId)).toEqual([]);

    await remove(rehab);
    expect(await state()).toEqual(cancelled);

    await remove(cancel);
    expect(await state()).toEqual({ status: "VIGENTE", hasBalance: false, ledger: 120 });
  });

  it("borrar la cancelación y después la rehabilitación no vuelve a cancelar", async () => {
    const cancel = await apply("SOLICITUD_CANCELACION");
    const rehab = await apply("REHABILITACION");
    await remove(cancel);
    expect(await state()).toEqual({ status: "VIGENTE", hasBalance: false, ledger: 120 });
    await remove(rehab);
    expect(await state()).toEqual({ status: "VIGENTE", hasBalance: false, ledger: 120 });
  });

  it("una cancelación anterior a la rehabilitación ya no rige", async () => {
    await apply("SOLICITUD_CANCELACION");
    await apply("REHABILITACION");
    const annul = await apply("SOLICITUD_ANULACION");
    expect((await activeTerminations(db, policyId)).map((t) => t.id)).toEqual([annul]);
    expect((await state()).status).toBe("ANULADA");
    await remove(annul);
    expect(await state()).toEqual({ status: "VIGENTE", hasBalance: false, ledger: 120 });
  });
});
