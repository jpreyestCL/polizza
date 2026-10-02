import { compareIssuance, type ComparePair } from "@/lib/domain/issuance-compare";

// El cliente de transacción extendido no es asignable a un tipo propio.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComparisonClient = any;

/**
 * Deja constancia de las diferencias y no impide crear la póliza.
 * blocksIssuance se guarda en falso aunque haya discrepancias.
 */
export async function saveIssuanceComparison(
  tx: ComparisonClient,
  args: {
    organizationId: string;
    proposalId: string;
    policyId: string;
    pairs: ComparePair[];
  },
): Promise<void> {
  const result = compareIssuance(args.pairs);
  const comparison = await tx.aiComparison.create({
    data: {
      organizationId: args.organizationId,
      proposalId: args.proposalId,
      policyId: args.policyId,
      verdict: result.verdict,
      blocksIssuance: false,
      summary:
        result.discrepancies.length === 0
          ? "Lo emitido coincide con lo pedido."
          : `${result.discrepancies.length} diferencia(s). La emisión no se bloquea.`,
    },
  });
  if (result.discrepancies.length === 0) return;
  await tx.aiDiscrepancy.createMany({
    data: result.discrepancies.map((row) => ({
      organizationId: args.organizationId,
      comparisonId: comparison.id,
      field: row.field,
      expectedValue: row.expectedValue,
      actualValue: row.actualValue,
    })),
  });
}
