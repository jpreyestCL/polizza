export type InstallmentForClose = {
  id: string;
  status: string;
  amount: number;
  /** Monto ya cobrado cuando la cuota está parcial. */
  amountPaid?: number | null;
};

export type InstallmentClosePlan = {
  paid: number;
  writtenOff: number;
  cancelIds: string[];
};

/**
 * Al cancelar o anular: pagada y presunta cuentan como cobradas; la castigada
 * sale del saldo; pendiente, rechazada y el saldo impago de la parcial se anulan.
 */
export function classifyInstallmentsForTermination(
  rows: InstallmentForClose[],
): InstallmentClosePlan {
  let paid = 0;
  let writtenOff = 0;
  const cancelIds: string[] = [];

  for (const row of rows) {
    if (row.status === "PAGADA" || row.status === "PRESUNTA") {
      paid += row.amount;
      continue;
    }
    if (row.status === "CASTIGADA") {
      writtenOff += row.amount;
      continue;
    }
    if (row.status === "PARCIAL") {
      const collected = Math.min(
        row.amount,
        Math.max(0, row.amountPaid ?? 0),
      );
      paid += collected;
      if (row.amount - collected > 0.00005) cancelIds.push(row.id);
      continue;
    }
    if (row.status === "PENDIENTE" || row.status === "RECHAZADA") {
      cancelIds.push(row.id);
    }
  }

  return { paid, writtenOff, cancelIds };
}
