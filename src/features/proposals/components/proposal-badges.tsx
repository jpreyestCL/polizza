import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type ProposalStatusValue } from "../schemas";
import type { SlaLevel } from "../sla";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

const STATUS_VARIANT: Record<ProposalStatusValue, BadgeVariant> = {
  ELABORACION: "secondary",
  POR_ENVIAR: "warning",
  ENVIADA_COMPANIA: "default",
  DEVUELTA: "warning",
  POR_DESPACHAR: "success",
};

export function ProposalStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status as ProposalStatusValue] ?? "muted";
  const label = STATUS_LABELS[status as ProposalStatusValue] ?? status;
  return <Badge variant={variant}>{label}</Badge>;
}

export function ProposalSlaBadge({
  level,
  days,
}: {
  level: SlaLevel;
  days: number;
}) {
  if (level === "critical") {
    return <Badge variant="destructive">SLA crítico · {days} d</Badge>;
  }
  if (level === "warning") {
    return <Badge variant="warning">SLA · {days} d</Badge>;
  }
  return (
    <span className="text-xs text-muted-foreground">
      {days} {days === 1 ? "día hábil" : "días hábiles"}
    </span>
  );
}
