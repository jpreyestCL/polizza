import "server-only";
import { basePrisma, type Db } from "@/server/db";
import { migrateItemData } from "@/lib/item-data-migration";
import type { PdfProposal } from "./pdf-template";

export async function buildProposalPdfData(
  db: Db,
  proposalId: string,
  options: { organizationName?: string } = {},
): Promise<PdfProposal | null> {
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId },
    include: {
      client: {
        select: {
          type: true,
          name: true,
          firstName: true,
          lastNamePaterno: true,
          lastNameMaterno: true,
          legalName: true,
          rut: true,
          email: true,
          phone: true,
          celular: true,
          address: true,
          commune: true,
          city: true,
          region: true,
        },
      },
      branchType: { select: { name: true } },
    },
  });
  if (!proposal) return null;

  const [
    items,
    paymentPlan,
    company,
    product,
    insured,
    beneficiary,
    contact,
  ] = await Promise.all([
    db.proposalItem.findMany({
      where: { proposalId },
      orderBy: { order: "asc" },
      include: {
        branchType: { select: { name: true } },
        coverages: { orderBy: { order: "asc" } },
      },
    }),
    db.paymentPlan.findUnique({ where: { proposalId } }),
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
    proposal.insuredClientId
      ? db.client.findFirst({
          where: { id: proposal.insuredClientId },
          select: { name: true },
        })
      : Promise.resolve(null),
    proposal.beneficiaryClientId
      ? db.client.findFirst({
          where: { id: proposal.beneficiaryClientId },
          select: { name: true },
        })
      : Promise.resolve(null),
    proposal.recipientContactId
      ? db.insuranceCompanyContact.findFirst({
          where: { id: proposal.recipientContactId },
          select: { name: true, lastName: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  // Totales
  let totalInsured = 0;
  let totalAffect = 0;
  let totalExempt = 0;
  let totalNet = 0;
  let totalIva = 0;
  let totalGross = 0;
  let totalCommission = 0;
  const itemsData = items.map((it) => {
    const coverages = it.coverages.map((c) => {
      if (c.sumsToTotal) {
        totalInsured += c.insuredAmount ? Number(c.insuredAmount) : 0;
        totalAffect += c.premiumAffect ? Number(c.premiumAffect) : 0;
        totalExempt += c.premiumExempt ? Number(c.premiumExempt) : 0;
        totalNet += c.premiumNet ? Number(c.premiumNet) : 0;
        totalIva += c.ivaAmount ? Number(c.ivaAmount) : 0;
        totalGross += c.premiumGross ? Number(c.premiumGross) : 0;
        totalCommission += c.commissionAmount ? Number(c.commissionAmount) : 0;
      }
      return {
        name: c.name,
        polCad: c.polCad,
        type: c.type,
        insuredAmount: c.insuredAmount ? Number(c.insuredAmount) : null,
        isCommercialValue: c.isCommercialValue,
        taxRateAffect: c.taxRateAffect ? Number(c.taxRateAffect) : null,
        taxRateExempt: c.taxRateExempt ? Number(c.taxRateExempt) : null,
        premiumAffect: c.premiumAffect ? Number(c.premiumAffect) : null,
        premiumExempt: c.premiumExempt ? Number(c.premiumExempt) : null,
        premiumNet: c.premiumNet ? Number(c.premiumNet) : null,
        ivaAmount: c.ivaAmount ? Number(c.ivaAmount) : null,
        premiumGross: c.premiumGross ? Number(c.premiumGross) : null,
        commissionAmount: c.commissionAmount
          ? Number(c.commissionAmount)
          : null,
      };
    });
    return {
      order: it.order,
      branchName: it.branchType.name,
      identification: it.identification,
      glossNote: it.glossNote,
      data: migrateItemData(it.data, it.dataSchemaVersion).data,
      coverages,
    };
  });

  const companyName = company?.globalCompany?.name ?? company?.name ?? null;
  const companyRut = company?.globalCompany?.rut ?? company?.rut ?? null;
  const companyLogo = company?.globalCompany?.logoUrl ?? company?.logoUrl ?? null;

  // Ejecutivo de cuentas del corredor (usuario asignado a la propuesta).
  const accountExec = proposal.assignedUserId
    ? await basePrisma.user.findUnique({
        where: { id: proposal.assignedUserId },
        select: { name: true },
      })
    : null;

  // Renovación
  const previousPolicy = proposal.previousPolicyId
    ? await db.policy.findFirst({
        where: { id: proposal.previousPolicyId },
        select: { policyNumber: true },
      })
    : null;

  // Organización (corredora)
  const organization = options.organizationName
    ? { name: options.organizationName }
    : await basePrisma.organization.findUnique({
        where: { id: proposal.organizationId },
        select: { name: true },
      });

  // Asegurado y Beneficiario detallados (para mostrar dirección en PDF)
  const insuredFull = proposal.insuredClientId
    ? await db.client.findFirst({
        where: { id: proposal.insuredClientId },
        select: {
          name: true,
          rut: true,
          address: true,
          commune: true,
          region: true,
        },
      })
    : null;
  const beneficiaryFull = proposal.beneficiaryClientId
    ? await db.client.findFirst({
        where: { id: proposal.beneficiaryClientId },
        select: {
          name: true,
          rut: true,
          address: true,
          commune: true,
          region: true,
        },
      })
    : null;

  const insuredFallback = insuredFull ?? {
    name: proposal.client.name,
    rut: proposal.client.rut,
    address: proposal.client.address,
    commune: proposal.client.commune,
    region: proposal.client.region,
  };
  const beneficiaryFallback = beneficiaryFull ?? insuredFallback;

  return {
    proposalNumber: proposal.proposalNumber,
    createdAt: proposal.createdAt,
    sentAt: proposal.sentAt,
    startDate: proposal.startDate,
    endDate: proposal.endDate,
    startTime: proposal.startTime,
    endTime: proposal.endTime,
    status: proposal.status,
    currency: proposal.currency,
    observations: proposal.observations,
    isRenovation: Boolean(proposal.previousPolicyId),
    previousPolicyNumber: previousPolicy?.policyNumber ?? null,
    quotationNumberRef: proposal.quotationNumberRef ?? null,
    organizationName: organization?.name ?? "Polizza",
    clientType: proposal.client.type,
    clientName: proposal.client.name,
    clientFirstName: proposal.client.firstName,
    clientLastNamePaterno: proposal.client.lastNamePaterno,
    clientLastNameMaterno: proposal.client.lastNameMaterno,
    clientLegalName: proposal.client.legalName,
    clientRut: proposal.client.rut,
    // Obs 12: el PDF usa los datos de contacto guardados en la elaboración de
    // la propuesta (editables por el corredor). Si no se editaron, caen por
    // defecto a los de la ficha del contratante.
    clientEmail: proposal.contratanteEmail ?? proposal.client.email,
    clientPhone: proposal.contratantePhone ?? proposal.client.phone,
    clientCelular: proposal.contratanteCelular ?? proposal.client.celular,
    clientAddress: proposal.client.address,
    clientCommune: proposal.client.commune,
    clientCity: proposal.client.city,
    clientRegion: proposal.client.region,
    companyName,
    companyRut,
    companyLogoUrl: companyLogo,
    brokerCode: company?.brokerCode ?? null,
    accountExecName: accountExec?.name ?? null,
    contactName: contact
      ? `${contact.name}${contact.lastName ? " " + contact.lastName : ""}`
      : null,
    contactEmail: contact?.email ?? proposal.recipientEmail ?? null,
    productName: product?.name ?? null,
    branchName: proposal.branchType?.name ?? null,
    insured: {
      name: insuredFallback.name,
      rut: insuredFallback.rut,
      address: insuredFallback.address,
      commune: insuredFallback.commune,
      region: insuredFallback.region,
    },
    beneficiary: {
      name: beneficiaryFallback.name,
      rut: beneficiaryFallback.rut,
      address: beneficiaryFallback.address,
      commune: beneficiaryFallback.commune,
      region: beneficiaryFallback.region,
    },
    commissionAffectPct: proposal.commissionAffectPct
      ? Number(proposal.commissionAffectPct)
      : null,
    commissionExemptPct: proposal.commissionExemptPct
      ? Number(proposal.commissionExemptPct)
      : null,
    items: itemsData,
    totals: {
      insured: totalInsured,
      premiumAffect: totalAffect,
      premiumExempt: totalExempt,
      premiumNet: totalNet,
      iva: totalIva,
      premiumGross: totalGross,
      commission: totalCommission,
    },
    paymentPlan: paymentPlan
      ? {
          option: paymentPlan.option,
          installmentsCount: paymentPlan.installmentsCount,
          valorCuota: paymentPlan.valorCuota
            ? Number(paymentPlan.valorCuota)
            : null,
          firstPaymentDate: paymentPlan.firstPaymentDate,
          firstSignDate: paymentPlan.firstSignDate,
          payerName:
            [paymentPlan.payerName, paymentPlan.payerLastName]
              .filter(Boolean)
              .join(" ") ||
            paymentPlan.payerLegalName ||
            null,
          payerRut: paymentPlan.payerRut,
          documented: paymentPlan.documented,
        }
      : null,
  };
}
