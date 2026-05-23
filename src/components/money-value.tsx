import { formatMoney, type CurrencyCode } from "@/lib/money";
import { clpEquivalent } from "@/lib/uf";

/**
 * Muestra un monto con su moneda y, cuando está en UF y hay valor de UF
 * disponible, su equivalente aproximado en pesos chilenos.
 */
export function MoneyValue({
  amount,
  currency,
  ufValue,
}: {
  amount: number | null | undefined;
  currency: string;
  ufValue?: number | null;
}) {
  if (amount === null || amount === undefined) {
    return <>—</>;
  }
  const clp = clpEquivalent(amount, currency, ufValue ?? null);
  return (
    <>
      {formatMoney(amount, currency as CurrencyCode)}
      {clp && (
        <span className="block text-xs font-normal text-muted-foreground">
          ≈ {clp}
        </span>
      )}
    </>
  );
}
