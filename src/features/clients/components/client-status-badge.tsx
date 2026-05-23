import { Badge } from "@/components/ui/badge";

type StatusMeta = {
  label: string;
  variant: "success" | "warning" | "muted";
};

const STATUS_META: Record<string, StatusMeta> = {
  ACTIVO: { label: "Activo", variant: "success" },
  PROSPECTO: { label: "Prospecto", variant: "warning" },
  INACTIVO: { label: "Inactivo", variant: "muted" },
};

export function ClientStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, variant: "muted" };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
