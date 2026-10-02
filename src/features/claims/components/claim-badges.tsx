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
  REPORTED: "secondary",
  AWAITING_ASSIGNMENT: "warning",
  IN_ADJUSTMENT: "default",
  PAYMENT_PROCESS: "warning",
  CLOSED: "muted",
  VOID: "destructive",
};

export function ClaimStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status as ClaimStatusValue] ?? "muted";
  const label = CLAIM_STATUS_LABELS[status as ClaimStatusValue] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}
