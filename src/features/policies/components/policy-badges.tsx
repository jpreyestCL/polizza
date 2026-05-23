import { Badge } from "@/components/ui/badge";
import { POLICY_STATUS_LABELS, type PolicyStatusValue } from "../schemas";
import type { RenewalLevel } from "@/lib/renewal";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

const STATUS_VARIANT: Record<PolicyStatusValue, BadgeVariant> = {
  VIGENTE: "success",
  VENCIDA: "destructive",
  RENOVADA: "secondary",
  CANCELADA: "muted",
  ANULADA: "muted",
};

export function PolicyStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status as PolicyStatusValue] ?? "muted";
  const label = POLICY_STATUS_LABELS[status as PolicyStatusValue] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}

export function PolicyRenewalBadge({
  level,
  days,
}: {
  level: RenewalLevel;
  days: number | null;
}) {
  if (level === "vencida") {
    return (
      <Badge variant="destructive">
        Vencida hace {Math.abs(days ?? 0)} d
      </Badge>
    );
  }
  if (level === "urgente") {
    return <Badge variant="destructive">Vence en {days} d</Badge>;
  }
  if (level === "proxima") {
    return <Badge variant="warning">Vence en {days} d</Badge>;
  }
  return null;
}
