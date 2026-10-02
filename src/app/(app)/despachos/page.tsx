import Link from "next/link";
import { requireOrgDb } from "@/server/context";
import { PageHeader } from "@/components/page-header";

const LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
};

export default async function DespachosPage() {
  const { db } = await requireOrgDb();
  const rows = await db.dispatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      proposal: { select: { id: true, proposalNumber: true } },
      policy: { select: { id: true, policyNumber: true } },
    },
  });
  const pending = rows.filter((row) => row.status === "PENDIENTE").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despachos"
        description="La cola se abre al recepcionar la póliza y pasa a enviada cuando se despacha al contratante."
      />
      <p className="text-sm text-muted-foreground">{pending} pendientes en esta lista.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay despachos.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <Link href={`/propuestas/${row.proposal.id}`} className="font-medium hover:underline">
                Propuesta {row.proposal.proposalNumber}
              </Link>
              <span className="text-muted-foreground">
                {LABEL[row.status] ?? row.status}
                {row.policy ? ` · póliza ${row.policy.policyNumber}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
