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
        description="Clientes en RUT;nombre;teléfono;PERSONA o EMPRESA. El texto de Brokeris se traduce con el mapa de códigos. Al aplicar, una fila traducida con número de póliza y RUT crea la ficha; una fila en revisión se queda en el lote."
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
          Columnas separadas por tabulación. Pólizas: id, estado, es renovación, id madre,
          vigencia, número, RUT, nombre, prima, moneda, inicio, fin, compañía y, si vienen, glosa
          del ítem, monto asegurado y coberturas (Daños=500|RC=1000). Una compañía que no está
          en la corredora se crea como propia. Sin RUT y número
          la fila se traduce y no se crea. Endosos: id, tipo, número de póliza, vigencia, delta,
          detalle. Siniestros: id, estado, subestado, cierre, número de póliza, relato.
          Documentos: id, etiqueta; no se inventa el archivo. No renovación: id, tipo, motivo,
          número de póliza. El tipo 2 exige motivo.
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
            placeholder={"pol-1\t4\t1\tpol-0\t01-01-2026\tPOL-100"}
          />
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">
          Traducir
        </button>
      </form>

      <form action={previewCuadreAction} className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Cuadre del corte 29-09-2026</h2>
        <p className="text-sm text-muted-foreground">
          Q2 es informativo y no entra al Gate A. Los campos nacen vacíos: comparar sin conteos
          deja el Gate A fuera. La referencia del 29-09-2026 va entre paréntesis. El orden de carga
          es {BROKERIS_LOAD_ORDER.join(" → ")}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField name="policiesInForce" label={`Q1 pólizas vigentes (${ref.policiesInForce})`} />
          <NumberField name="endorsementsInForce" label={`Q2 endosos vigentes (${ref.endorsementsInForce})`} />
          <NumberField name="contractors" label={`Q5 contratantes (${ref.contractors})`} />
          <NumberField name="insureds" label={`Q5 asegurados (${ref.insureds})`} />
          <NumberField name="companiesBeforeMerge" label={`Q6 empresas antes (${ref.companies})`} />
          <NumberField name="personsBeforeMerge" label={`Q6 particulares antes (${ref.persons})`} />
          <NumberField name="companiesAfterMerge" label={`Q6 empresas después (${ref.companies})`} />
          <NumberField name="personsAfterMerge" label={`Q6 particulares después (${ref.persons})`} />
          <NumberField name="renewalsCutMonth" label={`Q7 renovaciones del mes (${ref.renewalsCutMonth})`} />
          <NumberField name="renewalsNextMonth" label={`Q7 renovaciones del siguiente (${ref.renewalsNextMonth})`} />
          <NumberField name="openClaims" label={`Q8 siniestros abiertos (${ref.openClaims})`} />
          <NumberField name="claimsToExtend" label={`Q8 por prorrogar (${ref.claimsToExtend})`} />
          <NumberField name="approvedInstallmentCount" label="Q9 cuotas de la decisión" />
          <NumberField name="pendingInstallmentCount" label="Q9 cuotas pendientes" />
          <NumberField name="approvedInstallmentAmount" label="Q9 monto de la decisión" />
          <NumberField name="pendingInstallmentAmount" label="Q9 monto pendiente" />
          <NumberField name="commissionYear" label="Q10 año" />
          <NumberField name="brokerisCommissionClp" label="Q10 pesos en Brokeris" />
          <NumberField name="polizzaCommissionClp" label="Q10 pesos en Polizza" />
          <NumberField name="grossPremium2025Clp" label={`Q11 prima bruta 2025 (${ref.grossPremium2025Clp})`} />
          <NumberField name="commissions2025Clp" label={`Q11 comisiones 2025 (${ref.commissions2025Clp})`} />
          <NumberField name="documentsTotal" label="Q12 documentos" />
          <NumberField name="documentsLinked" label="Q12 enlazados" />
          <NumberField name="maxProposal" label={`Q13 máximo de propuesta (${ref.maxProposal})`} />
          <NumberField name="counterProposal" label={`Q13 contador de propuesta (${ref.maxProposal + 1})`} />
          <NumberField name="maxClaimFolder" label={`Q13 máximo de carpeta (${ref.maxClaimFolder})`} />
          <NumberField name="counterClaimFolder" label={`Q13 contador de carpeta (${ref.maxClaimFolder + 1})`} />
          <NumberField name="maxPlan" label={`Q13 máximo de plan (${ref.maxPlan})`} />
          <NumberField name="counterPlan" label={`Q13 contador de plan (${ref.maxPlan + 1})`} />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Q3 diferencias de prima en UF, una por póliza. La coma es decimal: 0,01
          <input name="policyPremiumDiffsUf" className={inputClass} placeholder="0,01" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Q4 diferencias de comisión en UF, una por movimiento
          <input name="commissionDiffsUf" className={inputClass} placeholder="0,01" />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <Check name="installmentDecisionRecorded" label="Q9: la dueña ya eligió el grupo A, B, C o D" />
          <Check name="documentsCounted" label="Q12: el conteo de documentos ya está hecho" />
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
                {job.profile === "CUADRE" ? "Registrar lote" : "Aplicar"}
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

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input name={name} type="number" step="any" className={inputClass} />
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
