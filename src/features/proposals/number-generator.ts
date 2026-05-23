import "server-only";
import { basePrisma } from "@/server/db";
import { formatProposalNumber } from "./number-generator-format";

export { formatProposalNumber };

type DbLike = typeof basePrisma;

/**
 * Genera un número de propuesta atómicamente para una organización.
 * Reemplaza tokens {YEAR} y {SEQ:NNNN} (donde N's definen el zero-padding).
 * Reinicia la secuencia cuando cambia el año.
 *
 * Nota: usa `basePrisma` o un cliente Prisma sin scoping de tenant porque
 * `Organization` no está en el set TENANT_MODELS.
 */
export async function generateProposalNumber(
  db: DbLike,
  organizationId: string,
): Promise<string> {
  const year = new Date().getFullYear();

  const result = await db.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        proposalNumberPattern: true,
        proposalSequenceYear: true,
        proposalSequenceValue: true,
      },
    });
    if (!org) throw new Error("Organización no encontrada");

    const sameYear = org.proposalSequenceYear === year;
    const nextSeq = sameYear ? org.proposalSequenceValue + 1 : 1;

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        proposalSequenceYear: year,
        proposalSequenceValue: nextSeq,
      },
    });

    return { pattern: org.proposalNumberPattern, seq: nextSeq };
  });

  return formatProposalNumber(result.pattern, year, result.seq);
}
