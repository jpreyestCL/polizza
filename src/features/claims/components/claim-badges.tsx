import { Badge } from "@/components/ui/badge";
import { CLAIM_STATUS_LABELS, type ClaimStatusValue } from "../schemas";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

const STATUS_VARIANT: Record<ClaimStatusValue, BadgeVariant> = {
  REPORTADO: "secondary",
  INGRESADO_COMPANIA: "warning",
  EN_EVALUACION: "default",
  APROBADO: "success",
  RECHAZADO: "destructive",
  PAGADO: "success",
  CERRADO: "muted",
};

export function ClaimStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status as ClaimStatusValue] ?? "muted";
  const label = CLAIM_STATUS_LABELS[status as ClaimStatusValue] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}
