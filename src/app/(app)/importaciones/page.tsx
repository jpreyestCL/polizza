import { requireOrgDb } from "@/server/context";
import { PageHeader } from "@/components/page-header";
import {
  applyImportAction,
  previewImportAction,
  revertImportAction,
} from "@/features/imports/actions";

export default async function ImportacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  const jobId = typeof sp.job === "string" ? sp.job : null;
  const { db } = await requireOrgDb();
  const job = jobId
    ? await db.importJob.findFirst({
        where: { id: jobId },
        include: { rows: { orderBy: { rowNo: "asc" } } },
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importaciones"
        description="Pega un archivo de clientes, una fila por línea: RUT;nombre;teléfono;PERSONA o EMPRESA. Primero se previsualiza y después se puede deshacer."
      />
      {aviso ? <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{aviso}</p> : null}
      <form action={previewImportAction} className="space-y-3 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          Filas
          <textarea name="rows" required rows={8} className="rounded-md border bg-background px-2 py-1.5 font-mono text-xs" placeholder="12.345.678-5;Ana Pérez;+56912345678;PERSONA" />
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">Previsualizar</button>
      </form>
      {job ? (
        <section className="space-y-3">
          <p className="text-sm">
            Lote {job.status}. {job.rows.length} filas.
          </p>
          <ul className="space-y-1 text-sm">
            {job.rows.map((row: { id: string; rowNo: number; action: string; message: string | null }) => (
              <li key={row.id}>
                {row.rowNo}. {row.action}
                {row.message ? ` — ${row.message}` : ""}
              </li>
            ))}
          </ul>
          {job.status === "PREVIEW" ? (
            <form action={applyImportAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <button type="submit" className="rounded-md border px-3 py-2 text-sm">Aplicar</button>
            </form>
          ) : null}
          {job.status === "APLICADO" ? (
            <form action={revertImportAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="jobId" value={job.id} />
              <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
                Motivo para revertir
                <input name="reason" required minLength={10} className="rounded-md border bg-background px-2 py-1.5" />
              </label>
              <button type="submit" className="rounded-md border px-3 py-2 text-sm">Revertir</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
