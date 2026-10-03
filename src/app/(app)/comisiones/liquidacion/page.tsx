import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import { postCommissionStatementAction } from "@/features/commissions/statement-actions";
import { PageHeader } from "@/components/page-header";

export default async function LiquidacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "commissions.reconcile")) redirect("/panel");
  const sp = await searchParams;
  const statements = await db.commissionStatement.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { lines: { select: { id: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Liquidación de la compañía"
        description="Una línea por póliza: número y monto, separados por espacio, tabulación o punto y coma. También puedes subir el CSV de la compañía: si trae encabezado, se toman las columnas de póliza y de comisión (o monto) en cualquier orden, con comillas y separador de miles. El calce parte o junta montos contra la comisión esperada de esa póliza y esa moneda."
      />
      <p className="text-sm">
        <Link href="/comisiones" className="text-primary hover:underline">Volver a revisión</Link>
      </p>
      {sp.ok === "1" ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          Se cargaron {sp.lineas} líneas, con {sp.calces} calces. {sp.sinPoliza} líneas no tenían esa póliza en la cartera
          {typeof sp.faltan === "string" && sp.faltan ? `: ${sp.faltan}` : ""}.{" "}
          {sp.sinComision ?? 0} líneas tenían póliza y no una comisión pendiente
          {typeof sp.pendientes === "string" && sp.pendientes ? `: ${sp.pendientes}` : ""}.
          {sp.negativos && sp.negativos !== "0" ? (
            <>
              {" "}
              {sp.negativos} líneas vienen con monto negativo (reversas de la compañía) y quedan sin calzar para
              revisarlas a mano
              {typeof sp.ajustes === "string" && sp.ajustes ? `: ${sp.ajustes}` : ""}.
            </>
          ) : null}
        </p>
      ) : null}
      {sp.error === "datos" ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          Indica la compañía y al menos una línea con número de póliza y monto.
        </p>
      ) : null}
      <form action={postCommissionStatementAction} encType="multipart/form-data" className="space-y-3 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          Compañía
          <input name="insurerName" required className="rounded-md border bg-background px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Moneda
          <input name="currency" defaultValue="UF" className="rounded-md border bg-background px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Archivo
          <input name="file" type="file" accept=".csv,.txt,text/csv,text/plain" className="text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Líneas
          <textarea name="lines" rows={8} placeholder={"POL-100 12.5\nPOL-200;4"} className="rounded-md border bg-background px-2 py-1.5 font-mono text-sm" />
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">Cargar y calzar</button>
      </form>
      <ul className="divide-y rounded-xl border bg-card text-sm">
        {statements.map((statement) => (
          <li key={statement.id} className="flex justify-between px-4 py-3">
            <span>{statement.insurerName ?? "Sin compañía"}</span>
            <span className="text-muted-foreground">
              {statement.currency} · {statement.lines.length} líneas · {statement.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
