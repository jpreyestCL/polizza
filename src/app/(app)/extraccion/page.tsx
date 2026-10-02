import { requireOrgDb } from "@/server/context";
import { PageHeader } from "@/components/page-header";
import {
  extractTextAction,
  reviewExtractionAction,
} from "@/features/extraction/actions";
import { featureEnabled } from "@/server/tenant-features";

export default async function ExtraccionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  const { ctx, db } = await requireOrgDb();
  const enabled = await featureEnabled(db, ctx.organizationId, "AI_EXTRACTION");
  const rows = await db.aiExtraction.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extracción"
        description="Lee el texto de una póliza en este servidor. No envía el documento a un modelo externo y no bloquea la emisión."
      />
      {aviso ? <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{aviso}</p> : null}
      {!enabled ? (
        <p className="text-sm">FEATURE_DISABLED: la extracción no está contratada.</p>
      ) : (
        <form action={extractTextAction} className="space-y-3 rounded-xl border bg-card p-4">
          <label className="flex flex-col gap-1 text-sm">
            Texto del documento
            <textarea name="sourceText" required minLength={20} rows={8} className="rounded-md border bg-background px-2 py-1.5" placeholder="Póliza N° ABC-123 Prima neta 15,5 Desde 01-03-2026 Hasta 01-03-2027" />
          </label>
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">Extraer</button>
        </form>
      )}
      <ul className="space-y-3">
        {rows.map((row: {
          id: string;
          status: string;
          policyNumber: string | null;
          premiumNet: { toString(): string } | null;
          startDate: string | null;
          endDate: string | null;
          sourceKind: string;
        }) => (
          <li key={row.id} className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">
              {row.sourceKind} · {row.status}
              {row.policyNumber ? ` · ${row.policyNumber}` : ""}
            </p>
            <p className="text-muted-foreground">
              Prima {row.premiumNet ? row.premiumNet.toString() : "—"} · {row.startDate ?? "—"} a {row.endDate ?? "—"}
            </p>
            {row.status === "EXTRACTED" || row.status === "NEEDS_REVIEW" ? (
              <form action={reviewExtractionAction} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={row.id} />
                <button name="decision" value="ACCEPTED" className="rounded-md border px-2 py-1">Aceptar</button>
                <button name="decision" value="REJECTED" className="rounded-md border px-2 py-1">Rechazar</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
