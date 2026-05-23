import { Badge } from "@/components/ui/badge";
import {
  CAR_QUOTATION_STATUS_LABELS,
  RESULT_STATUS_LABELS,
  type CarQuotationStatusValue,
  type ResultStatusValue,
} from "../schemas";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

export function QuotationStatusBadge({ status }: { status: string }) {
  const label =
    CAR_QUOTATION_STATUS_LABELS[status as CarQuotationStatusValue] ?? status;
  const variant: BadgeVariant =
    status === "COMPLETADA"
      ? "success"
      : status === "EN_PROCESO"
        ? "secondary"
        : status === "ERROR"
          ? "destructive"
          : "muted";
  return <Badge variant={variant}>{label}</Badge>;
}

export function ResultStatusBadge({ status }: { status: string }) {
  const label = RESULT_STATUS_LABELS[status as ResultStatusValue] ?? status;
  const variant: BadgeVariant =
    status === "OBTENIDA"
      ? "success"
      : status === "EN_PROCESO"
        ? "secondary"
        : status === "ERROR"
          ? "destructive"
          : "muted";
  return <Badge variant={variant}>{label}</Badge>;
}
