export type CommissionPasteLine = {
  policyNumber: string;
  amount: number;
};

/**
 * Una línea es número de póliza y monto. Separa por espacio, tabulación o
 * punto y coma. La coma del monto es decimal. Si la primera fila dice
 * póliza o monto, se toma como encabezado.
 */
export function parseCommissionLines(raw: string): CommissionPasteLine[] {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const parsed: CommissionPasteLine[] = [];
  rows.forEach((line, index) => {
    const byMark = line.split(/[;\t]/).map((part) => part.trim()).filter(Boolean);
    const cells = byMark.length >= 2 ? byMark : line.split(/\s+/);
    const policyNumber = cells[0] ?? "";
    const amountRaw = (cells[1] ?? "").replace(",", ".");
    if (
      index === 0 &&
      /poliza|póliza|monto|amount/i.test(policyNumber) &&
      !Number.isFinite(Number(amountRaw))
    ) {
      return;
    }
    const amount = Number(amountRaw);
    if (!policyNumber || !Number.isFinite(amount) || amount <= 0) return;
    parsed.push({ policyNumber, amount });
  });
  return parsed;
}
