import "server-only";
import { Prisma, type EndorsementType, type PolicyStatus } from "@prisma/client";
import { cleanRut, formatRut, isValidRut, rutSearchTerms } from "@/lib/rut";
import { appTypeForSpec } from "@/lib/domain/endorsement-catalog";
import { applyEndorsementToPolicy } from "@/features/endorsements/apply";
import { defaultSubstatus, isClaimStatus } from "@/lib/domain/claim-lifecycle";

type Tx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

type JobRow = {
  id: string;
  action: string;
  payload: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amount(value: unknown): number | null {
  const raw = text(value).replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDay(value: unknown): Date | null {
  const raw = text(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`);
  const cl = /^(\d{2})-(\d{2})-(\d{4})/.exec(raw);
  if (cl) return new Date(`${cl[3]}-${cl[2]}-${cl[1]}T00:00:00.000Z`);
  return null;
}

function policyStatusOf(status: string): PolicyStatus {
  switch (status) {
    case "SENT_TO_INSURER":
      return "ENVIADA";
    case "ISSUED":
      return "VIGENTE";
    case "REJECTED_BY_INSURER":
      return "RECHAZADA";
    case "CANCELLED":
      return "CANCELADA";
    case "ANNULLED":
      return "ANULADA";
    case "DISCARDED":
    case "DELETED":
      return "DESCARTADA";
    default:
      return "BORRADOR";
  }
}

function currencyOf(value: string): string {
  const code = value.toUpperCase();
  if (code === "CLF" || code === "UF") return "UF";
  if (code === "CLP" || code === "USD" || code === "EUR") return code;
  return "UF";
}

async function mark(
  tx: Tx,
  rowId: string,
  action: string,
  message: string,
  created?: { type: string; id: string },
) {
  await tx.importJobRow.update({
    where: { id: rowId },
    data: {
      action,
      message,
      ...(created
        ? { createdEntityType: created.type, createdEntityId: created.id }
        : {}),
    },
  });
}

export async function applyBrokerisJob(
  tx: Tx,
  input: {
    organizationId: string;
    userId: string;
    profile: string;
    rows: JobRow[];
  },
): Promise<number> {
  if (input.profile === "BROKERIS_DOCUMENTOS" || input.profile === "CUADRE") {
    return 0;
  }
  let created = 0;
  for (const row of input.rows) {
    if (row.action !== "TRADUCIDO") continue;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    if (input.profile === "BROKERIS_POLIZAS") {
      if (await applyPolicy(tx, input, row.id, payload)) created += 1;
    } else if (input.profile === "BROKERIS_ENDOSOS") {
      if (await applyEndorsement(tx, input, row.id, payload)) created += 1;
    } else if (input.profile === "BROKERIS_SINIESTROS") {
      if (await applyClaim(tx, input, row.id, payload)) created += 1;
    } else if (input.profile === "BROKERIS_NO_RENOVACION") {
      if (await applyNonRenewal(tx, input, row.id, payload)) created += 1;
    }
  }
  if (input.profile === "BROKERIS_POLIZAS") {
    await linkImportedRenewals(tx, input, input.rows);
  }
  return created;
}

const ISSUED = ["VIGENTE", "VENCIDA", "RENOVADA"];

/**
 * Une cada póliza importada con su madre (columna "id madre"). Se hace al
 * final del lote para que el orden de las filas no importe. Si la sucesora
 * ya está emitida, la madre queda renovada.
 */
async function linkImportedRenewals(
  tx: Tx,
  input: { organizationId: string; userId: string },
  rows: JobRow[],
): Promise<void> {
  const originals = new Map<
    string,
    { id: string; status: string; nextPolicyId: string | null }
  >();
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const childExternal = text(payload.id);
    const motherExternal = text(payload.renewedFromId);
    if (!childExternal || !motherExternal || childExternal === motherExternal) continue;
    const [child, mother] = await Promise.all([
      tx.policy.findFirst({
        where: { externalId: childExternal },
        select: {
          id: true,
          status: true,
          previousPolicyId: true,
          lineageId: true,
          termNumber: true,
        },
      }),
      tx.policy.findFirst({
        where: { externalId: motherExternal },
        select: {
          id: true,
          status: true,
          nextPolicyId: true,
          lineageId: true,
          termNumber: true,
        },
      }),
    ]);
    if (!child || !mother || child.previousPolicyId) continue;
    if (!originals.has(mother.id)) {
      originals.set(mother.id, {
        id: mother.id,
        status: mother.status,
        nextPolicyId: mother.nextPolicyId,
      });
    }
    await tx.policy.update({
      where: { id: child.id },
      data: {
        previousPolicyId: mother.id,
        lineageId: mother.lineageId ?? mother.id,
        termNumber: (mother.termNumber ?? 1) + 1,
      },
    });
    const renews =
      ISSUED.includes(child.status) &&
      (mother.status === "VIGENTE" || mother.status === "VENCIDA");
    await tx.policy.update({
      where: { id: mother.id },
      data: {
        ...(mother.nextPolicyId ? {} : { nextPolicyId: child.id }),
        ...(mother.lineageId ? {} : { lineageId: mother.id }),
        ...(renews ? { status: "RENOVADA" } : {}),
      },
    });
    if (renews) {
      await tx.policyStatusHistory.create({
        data: {
          organizationId: input.organizationId,
          policyId: mother.id,
          status: "RENOVADA",
          note: "Renovada por una póliza importada desde Brokeris",
          changedById: input.userId,
        },
      });
    }
    const stored = await tx.importJobRow.findFirst({
      where: { id: row.id },
      select: { payload: true },
    });
    await tx.importJobRow.update({
      where: { id: row.id },
      data: {
        payload: {
          ...((stored?.payload ?? payload) as Record<string, unknown>),
          _mother: originals.get(mother.id),
          _child: {
            id: child.id,
            previousPolicyId: child.previousPolicyId,
            lineageId: child.lineageId,
            termNumber: child.termNumber,
          },
        },
      },
    });
  }
}

async function applyPolicy(
  tx: Tx,
  input: { organizationId: string; userId: string },
  rowId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const policyNumber = text(payload.policyNumber);
  const rut = cleanRut(text(payload.clientRut));
  if (!policyNumber || !isValidRut(rut)) {
    await mark(
      tx,
      rowId,
      "REVISAR",
      "No se creó: faltan el número de póliza o un RUT de contratante válido.",
    );
    return false;
  }
  const externalId = text(payload.id);
  const existing = await tx.policy.findFirst({
    where: {
      OR: [
        { policyNumber },
        ...(externalId ? [{ externalId }] : []),
      ],
    },
    select: { id: true, lineageId: true },
  });
  if (existing) {
    if (!existing.lineageId && text(payload.lineageId)) {
      await tx.policy.update({
        where: { id: existing.id },
        data: {
          lineageId: text(payload.lineageId),
          termNumber: Number(payload.termNumber) || 1,
        },
      });
    }
    await mark(tx, rowId, "OMITIR", "La póliza ya estaba en la cartera.");
    return false;
  }
  const companyName = text(payload.companyName);
  let createdCompanyId: string | null = null;
  let company: { id: string } | null = null;
  if (companyName) {
    company =
      (await tx.insuranceCompany.findFirst({
        where: {
          OR: [
            { name: { equals: companyName, mode: "insensitive" } },
            { globalCompany: { name: { equals: companyName, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
      })) ?? null;
    if (!company && companyName.length >= 4) {
      const partial: { id: string }[] = await tx.insuranceCompany.findMany({
        where: {
          OR: [
            { name: { contains: companyName, mode: "insensitive" } },
            { globalCompany: { name: { contains: companyName, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
        take: 2,
      });
      if (partial.length > 1) {
        await mark(
          tx,
          rowId,
          "REVISAR",
          `No se creó: «${companyName}» calza con más de una compañía de la corredora. Usa el nombre completo.`,
        );
        return false;
      }
      company = partial[0] ?? null;
    }
  }
  const terms = rutSearchTerms(rut);
  let client = await tx.client.findFirst({
    where: { OR: terms.map((term) => ({ rut: term })) },
    select: { id: true },
  });
  if (!client) {
    const name = text(payload.clientName);
    if (name.length < 2) {
      await mark(tx, rowId, "REVISAR", "No se creó: el contratante no existe y falta el nombre.");
      return false;
    }
    client = await tx.client.create({
      data: {
        organizationId: input.organizationId,
        type: /\b(spa|ltda|s\.a\.|eirl)\b/i.test(name) ? "EMPRESA" : "PERSONA",
        rut: formatRut(rut),
        name,
        status: "ACTIVO",
        source: "IMPORTACION",
        createdById: input.userId,
      },
      select: { id: true },
    });
  }
  if (companyName && !company) {
    const newCompany: { id: string } = await tx.insuranceCompany.create({
      data: {
        organizationId: input.organizationId,
        name: companyName,
        status: "ACTIVA",
      },
      select: { id: true },
    });
    company = newCompany;
    createdCompanyId = newCompany.id;
  }
  const premium = amount(payload.premium);
  const status = policyStatusOf(text(payload.status));
  const policy = await tx.policy.create({
    data: {
      organizationId: input.organizationId,
      clientId: client.id,
      policyNumber,
      externalId: text(payload.id) || null,
      companyId: company?.id ?? null,
      status,
      premiumNet: premium == null ? null : new Prisma.Decimal(premium.toFixed(2)),
      currency: currencyOf(text(payload.currency)),
      startDate: parseDay(payload.startDate),
      endDate: parseDay(payload.endDate),
      lineageId: text(payload.lineageId) || null,
      termNumber: Number(payload.termNumber) || 1,
      createdById: input.userId,
    },
    select: { id: true },
  });
  if (!text(payload.lineageId)) {
    await tx.policy.update({
      where: { id: policy.id },
      data: { lineageId: policy.id },
    });
  }
  await tx.policyStatusHistory.create({
    data: {
      organizationId: input.organizationId,
      policyId: policy.id,
      status,
      note: "Importada desde Brokeris",
      changedById: input.userId,
    },
  });
  const currency = currencyOf(text(payload.currency));
  const itemDescription = text(payload.itemDescription);
  const insuredAmount = amount(payload.insuredAmount);
  const coverages = Array.isArray(payload.coverages)
    ? (payload.coverages as { name?: unknown; insuredAmount?: unknown }[])
    : [];
  if (itemDescription || insuredAmount != null) {
    await tx.policyItem.create({
      data: {
        organizationId: input.organizationId,
        policyId: policy.id,
        description: itemDescription || policyNumber,
        insuredAmount:
          insuredAmount == null ? null : new Prisma.Decimal(insuredAmount.toFixed(2)),
        currency,
      },
    });
  }
  const coverageRows = coverages
    .map((coverage) => ({ name: text(coverage.name), value: amount(coverage.insuredAmount) }))
    .filter((coverage) => coverage.name);
  if (coverageRows.length > 0) {
    await tx.policyCoverage.createMany({
      data: coverageRows.map((coverage) => ({
        organizationId: input.organizationId,
        policyId: policy.id,
        name: coverage.name,
        insuredAmount:
          coverage.value == null ? null : new Prisma.Decimal(coverage.value.toFixed(2)),
        currency,
      })),
    });
  }
  await mark(
    tx,
    rowId,
    "CREADO",
    createdCompanyId
      ? `Póliza creada. Se agregó la compañía ${companyName} a la corredora.`
      : "Póliza creada.",
    { type: "POLICY", id: policy.id },
  );
  if (createdCompanyId) {
    await tx.importJobRow.update({
      where: { id: rowId },
      data: { payload: { ...payload, _createdCompanyId: createdCompanyId } },
    });
  }
  return true;
}

async function applyEndorsement(
  tx: Tx,
  input: { organizationId: string; userId: string },
  rowId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const policyNumber = text(payload.policyNumber);
  const policy = policyNumber
    ? await tx.policy.findFirst({
        where: { policyNumber },
        select: { id: true },
      })
    : null;
  if (!policy) {
    await mark(tx, rowId, "REVISAR", "No se creó: falta la póliza de ese número.");
    return false;
  }
  const type = appTypeForSpec(text(payload.code)) as EndorsementType;
  const delta = amount(payload.premiumDelta);
  const result = await applyEndorsementToPolicy(tx, {
    organizationId: input.organizationId,
    userId: input.userId,
    policyId: policy.id,
    type,
    effectiveDate: parseDay(payload.effectiveDate) ?? new Date(),
    endDate: null,
    endorsementNumber: text(payload.id) || null,
    detail: text(payload.detail) || null,
    notes: "Importado desde Brokeris",
    proposalId: null,
    premiumAffectedDelta: delta,
    premiumExemptDelta: null,
    initiatedBy: text(payload.initiatedBy) || null,
    historical: true,
  });
  if (!result.ok) {
    await mark(tx, rowId, "REVISAR", result.error);
    return false;
  }
  await mark(tx, rowId, "CREADO", "Endoso creado.", { type: "ENDORSEMENT", id: result.id });
  return true;
}

async function applyClaim(
  tx: Tx,
  input: { organizationId: string; userId: string },
  rowId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const policyNumber = text(payload.policyNumber);
  const policy = policyNumber
    ? await tx.policy.findFirst({
        where: { policyNumber },
        select: { id: true, clientId: true },
      })
    : null;
  if (!policy) {
    await mark(tx, rowId, "REVISAR", "No se creó: falta la póliza de ese número.");
    return false;
  }
  const status = text(payload.status);
  if (!isClaimStatus(status)) {
    await mark(tx, rowId, "REVISAR", "No se creó: el estado del siniestro no se puede guardar.");
    return false;
  }
  const last = await tx.claim.findFirst({
    orderBy: { folderNumber: "desc" },
    select: { folderNumber: true },
  });
  const folderNumber = (last?.folderNumber ?? 0) + 1;
  const claim = await tx.claim.create({
    data: {
      organizationId: input.organizationId,
      clientId: policy.clientId,
      policyId: policy.id,
      claimNumber: `SIN-${new Date().getFullYear()}-${String(folderNumber).padStart(5, "0")}`,
      folderNumber,
      description: text(payload.description) || "Siniestro importado desde Brokeris",
      status,
      substatusCode: text(payload.substatus) || defaultSubstatus(status),
      closureOutcome: text(payload.closureOutcome) || null,
      closedAt: status === "CLOSED" ? new Date() : null,
      voidedAt: status === "VOID" ? new Date() : null,
      reportedAt: new Date(),
      createdById: input.userId,
      assignedUserId: input.userId,
    },
    select: { id: true },
  });
  await mark(tx, rowId, "CREADO", "Siniestro creado.", { type: "CLAIM", id: claim.id });
  return true;
}

async function applyNonRenewal(
  tx: Tx,
  input: { organizationId: string; userId: string },
  rowId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const policyNumber = text(payload.policyNumber) || text(payload.id);
  const externalId = text(payload.id);
  const policy = await tx.policy.findFirst({
    where: {
      OR: [
        { policyNumber },
        ...(externalId ? [{ externalId }] : []),
      ],
    },
    select: { id: true },
  });
  if (!policy) {
    await mark(tx, rowId, "REVISAR", "No se aplicó: no está la póliza.");
    return false;
  }
  const current = await tx.policy.findFirst({
    where: { id: policy.id },
    select: {
      notRenewable: true,
      nonRenewalReason: true,
      nonRenewalAt: true,
      nonRenewalNote: true,
    },
  });
  const type = text(payload.type);
  await tx.policy.update({
    where: { id: policy.id },
    data:
      type === "NOT_RENEWABLE"
        ? { notRenewable: true }
        : {
            nonRenewalReason: text(payload.reason) || null,
            nonRenewalAt: new Date(),
            nonRenewalNote: "Importada desde Brokeris",
          },
  });
  await tx.importJobRow.update({
    where: { id: rowId },
    data: {
      action: "CREADO",
      message: "No renovación aplicada.",
      createdEntityType: "NON_RENEWAL",
      createdEntityId: policy.id,
      payload: {
        ...payload,
        _prior: {
          notRenewable: current?.notRenewable ?? false,
          nonRenewalReason: current?.nonRenewalReason ?? null,
          nonRenewalAt: current?.nonRenewalAt
            ? current.nonRenewalAt.toISOString()
            : null,
          nonRenewalNote: current?.nonRenewalNote ?? null,
        },
      },
    },
  });
  return true;
}
