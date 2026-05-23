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
    status === "PAGADA"
      ? "success"
      : status === "ANULADA"
        ? "muted"
        : "secondary";
  const label =
    INSTALLMENT_STATUS_LABELS[status as InstallmentStatusValue] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}
