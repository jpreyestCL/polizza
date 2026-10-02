import { Badge } from "@/components/ui/badge";
import {
  INSTALLMENT_STATUS_LABELS,
  type InstallmentStatusValue,
} from "../schemas";

export function InstallmentBadge({
  status,
  overdue,
}: {
  status: string;
  overdue: boolean;
}) {
  if (overdue) {
    return <Badge variant="destructive">Vencida</Badge>;
  }
  const variant =
    status === "PAGADA" || status === "PRESUNTA"
      ? "success"
      : status === "ANULADA" || status === "CASTIGADA"
        ? "muted"
        : status === "RECHAZADA"
          ? "destructive"
          : "secondary";
  const label =
    INSTALLMENT_STATUS_LABELS[status as InstallmentStatusValue] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}
