import { requireOrgDb } from "@/server/context";
import { PageHeader } from "@/components/page-header";
import { BROKERIS_LOAD_ORDER, BROKERIS_REFERENCE } from "@/lib/domain/brokeris-cuadre";
import {
  applyImportAction,
  previewBrokerisAction,
  previewCuadreAction,
  previewImportAction,
  revertImportAction,
} from "@/features/imports/actions";

const inputClass = "rounded-md border bg-background px-2 py-1.5";

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
  const ref = BROKERIS_REFERENCE;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importaciones"
        description="Clientes en RUT;nombre;teléfono;PERSONA o EMPRESA. El texto de Brokeris se traduce con el mapa de códigos y el cuadre compara los conteos del corte 29-09-2026. El lote de Brokeris no crea pólizas."
      />
      {aviso ? <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{aviso}</p> : null}

      <form action={previewImportAction} className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Clientes</h2>
        <label className="flex flex-col gap-1 text-sm">
          Filas
          <textarea
            name="rows"
            required
            rows={6}
            className={`${inputClass} font-mono text-xs`}
            placeholder="12.345.678-5;Ana Pérez;+56912345678;PERSONA"
          />
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">
          Previsualizar
        </button>
      </form>

      <form action={previewBrokerisAction} className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Traducción Brokeris</h2>
        <p className="text-sm text-muted-foreground">
          Columnas separadas por tabulación. Pólizas: id, estado, es renovación (1 o 0), id madre,
          vigencia. Endosos: id, tipo. Siniestros: id, estado, subestado, tipo de cierre. Documentos:
          id, etiqueta. No renovación: id, tipo, motivo.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Perfil
          <select name="profile" className={inputClass}>
            <option value="POLIZAS">Pólizas</option>
            <option value="ENDOSOS">Endosos</option>
            <option value="SINIESTROS">Siniestros</option>
            <option value="DOCUMENTOS">Documentos</option>
            <option value="NO_RENOVACION">No renovación</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Filas
          <textarea
            name="rows"
            required
            rows={6}
            className={`${inputClass} font-mono text-xs`}
            placeholder={"pol-1\t4\t1\tpol-0\t2026-01-01"}
          />
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">
          Traducir
        </button>
      </form>

      <form action={previewCuadreAction} className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Cuadre del corte 29-09-2026</h2>
        <p className="text-sm text-muted-foreground">
          Q2 es informativo y no entra al Gate A. El orden de carga es{" "}
          {BROKERIS_LOAD_ORDER.join(" → ")}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField name="policiesInForce" label="Q1 pólizas vigentes" defaultValue={ref.policiesInForce} />
          <NumberField name="endorsementsInForce" label="Q2 endosos vigentes" defaultValue={ref.endorsementsInForce} />
          <NumberField name="contractors" label="Q5 contratantes" defaultValue={ref.contractors} />
          <NumberField name="insureds" label="Q5 asegurados" defaultValue={ref.insureds} />
          <NumberField name="companiesBeforeMerge" label="Q6 empresas antes" defaultValue={ref.companies} />
          <NumberField name="personsBeforeMerge" label="Q6 particulares antes" defaultValue={ref.persons} />
          <NumberField name="companiesAfterMerge" label="Q6 empresas después" defaultValue={ref.companies} />
          <NumberField name="personsAfterMerge" label="Q6 particulares después" defaultValue={ref.persons} />
          <NumberField name="renewalsCutMonth" label="Q7 renovaciones del mes" defaultValue={ref.renewalsCutMonth} />
          <NumberField name="renewalsNextMonth" label="Q7 renovaciones del siguiente" defaultValue={ref.renewalsNextMonth} />
          <NumberField name="openClaims" label="Q8 siniestros abiertos" defaultValue={ref.openClaims} />
          <NumberField name="claimsToExtend" label="Q8 por prorrogar" defaultValue={ref.claimsToExtend} />
          <NumberField name="approvedInstallmentCount" label="Q9 cuotas aprobadas" defaultValue={0} />
          <NumberField name="pendingInstallmentCount" label="Q9 cuotas pendientes" defaultValue={0} />
          <NumberField name="approvedInstallmentAmount" label="Q9 monto aprobado" defaultValue={0} />
          <NumberField name="pendingInstallmentAmount" label="Q9 monto pendiente" defaultValue={0} />
          <NumberField name="commissionYear" label="Q10 año" defaultValue={2025} />
          <NumberField name="brokerisCommissionClp" label="Q10 pesos en Brokeris" defaultValue={1000000} />
          <NumberField name="polizzaCommissionClp" label="Q10 pesos en Polizza" defaultValue={1000000} />
          <NumberField name="grossPremium2025Clp" label="Q11 prima bruta 2025" defaultValue={ref.grossPremium2025Clp} />
          <NumberField name="commissions2025Clp" label="Q11 comisiones 2025" defaultValue={ref.commissions2025Clp} />
          <NumberField name="documentsTotal" label="Q12 documentos" defaultValue={1} />
          <NumberField name="documentsLinked" label="Q12 enlazados" defaultValue={1} />
          <NumberField name="maxProposal" label="Q13 máximo de propuesta" defaultValue={ref.maxProposal} />
          <NumberField name="counterProposal" label="Q13 contador de propuesta" defaultValue={ref.maxProposal + 1} />
          <NumberField name="maxClaimFolder" label="Q13 máximo de carpeta" defaultValue={ref.maxClaimFolder} />
          <NumberField name="counterClaimFolder" label="Q13 contador de carpeta" defaultValue={ref.maxClaimFolder + 1} />
          <NumberField name="maxPlan" label="Q13 máximo de plan" defaultValue={ref.maxPlan} />
          <NumberField name="counterPlan" label="Q13 contador de plan" defaultValue={ref.maxPlan + 1} />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Q3 diferencias de prima en UF, una por póliza
          <input name="policyPremiumDiffsUf" defaultValue="0" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Q4 diferencias de comisión en UF, una por movimiento
          <input name="commissionDiffsUf" defaultValue="0" className={inputClass} />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <Check name="endorsementDifferenceExplained" label="Q2: la diferencia de endosos está explicada" />
          <Check name="commissionLargerDiffsExplained" label="Q4: las diferencias sobre 0,01 UF están explicadas" />
          <Check name="clientsAfterExplained" label="Q6: el conteo después de fusionar está explicado" />
          <Check name="claimsToExtendExplained" label="Q8: la diferencia de por prorrogar está explicada" />
          <Check name="times100Explained" label="Q10: la diferencia viene de un tipo de cambio ×100" />
          <Check name="productionExplained" label="Q11: la diferencia de producción está explicada" />
        </div>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">
          Comparar
        </button>
      </form>

      {job ? (
        <section className="space-y-3">
          <p className="text-sm">
            Lote {job.profile} {job.status}. {job.rows.length} filas.
            {job.decisionNote ? ` ${job.decisionNote}` : ""}
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
              <button type="submit" className="rounded-md border px-3 py-2 text-sm">
                {job.profile === "CLIENTES" ? "Aplicar" : "Registrar lote"}
              </button>
            </form>
          ) : null}
          {job.status === "APLICADO" ? (
            <form action={revertImportAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="jobId" value={job.id} />
              <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
                Motivo para revertir
                <input name="reason" required minLength={10} className={inputClass} />
              </label>
              <button type="submit" className="rounded-md border px-3 py-2 text-sm">
                Revertir
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input name={name} type="number" step="any" defaultValue={defaultValue} className={inputClass} />
    </label>
  );
}

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} />
      {label}
    </label>
  );
}
