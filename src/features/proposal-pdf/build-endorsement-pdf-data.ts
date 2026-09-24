import "server-only";
import { basePrisma, type Db } from "@/server/db";
import { currencyLabel } from "@/lib/money";
import { formatRut } from "@/lib/rut";
import { ENDORSEMENT_TYPE_LABELS } from "@/features/endorsements/schemas";
import type { PdfEndorsement } from "./endorsement-pdf-template";

/** Datos del PDF "Solicitud de Endoso" de una propuesta de endoso. */
export async function buildEndorsementPdfData(
  db: Db,
  proposalId: string,
  options: { organizationName?: string } = {},
): Promise<PdfEndorsement | null> {
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId, kind: "ENDOSO" },
    include: {
      client: { select: { name: true, legalName: true, rut: true } },
      branchType: { select: { name: true } },
    },
  });
  if (!proposal) return null;

  const [policy, company, product, branchOffice, accountExec, organization] =
    await Promise.all([
      proposal.endorsedPolicyId
        ? db.policy.findFirst({
            where: { id: proposal.endorsedPolicyId },
            select: { policyNumber: true, lineId: true },
          })
        : Promise.resolve(null),
      proposal.companyId
        ? db.insuranceCompany.findFirst({
            where: { id: proposal.companyId },
            include: { globalCompany: true },
          })
        : Promise.resolve(null),
      proposal.productId
        ? db.insuranceProduct.findFirst({
            where: { id: proposal.productId },
            select: { name: true },
          })
        : Promise.resolve(null),
      proposal.branchId
        ? db.branch.findFirst({
            where: { id: proposal.branchId },
            select: { name: true },
          })
        : Promise.resolve(null),
      proposal.assignedUserId
        ? basePrisma.user.findUnique({
            where: { id: proposal.assignedUserId },
            select: { name: true },
          })
        : Promise.resolve(null),
      options.organizationName
        ? Promise.resolve({ name: options.organizationName })
        : basePrisma.organization.findUnique({
            where: { id: proposal.organizationId },
            select: { name: true },
          }),
    ]);

  // Ramo: el de la propuesta (BranchType) o, en pólizas importadas sin
  // propuesta de origen, la línea de negocio de la póliza.
  const line =
    !proposal.branchType && policy?.lineId
      ? await db.insuranceLine.findFirst({
          where: { id: policy.lineId },
          select: { name: true },
        })
      : null;

  const typeLabel = proposal.endorsementType
    ? ENDORSEMENT_TYPE_LABELS[proposal.endorsementType]
    : "Endoso";

  return {
    kind: "ENDOSO",
    proposalNumber: proposal.proposalNumber,
    createdAt: proposal.createdAt,
    endorsementTypeLabel: typeLabel,
    policyNumber: policy?.policyNumber ?? null,
    branchOfficeName: branchOffice?.name ?? null,
    startDate: proposal.startDate,
    endDate: proposal.endDate,
    startTime: proposal.startTime,
    endTime: proposal.endTime,
    currencyLabel: currencyLabel(proposal.currency),
    branchName: proposal.branchType?.name ?? line?.name ?? null,
    productName: product?.name ?? null,
    organizationName: organization?.name ?? "Polizza",
    organizationRut: null,
    brokerCode: company?.brokerCode ?? null,
    accountExecName: accountExec?.name ?? null,
    commissionPct:
      proposal.commissionAffectPct != null
        ? Number(proposal.commissionAffectPct)
        : null,
    companyName: company?.globalCompany?.name ?? company?.name ?? null,
    companyLogoUrl: company?.globalCompany?.logoUrl ?? company?.logoUrl ?? null,
    clientName: proposal.client.legalName ?? proposal.client.name,
    clientRut: proposal.client.rut ? formatRut(proposal.client.rut) : null,
    detail: proposal.endorsementDetail ?? "",
  };
}
