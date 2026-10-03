import { Wallet } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { listAllInstallments } from "@/features/billing/queries";
import { CobranzaOverview } from "@/features/billing/components/cobranza-overview";
import { PageHeader } from "@/components/page-header";
import { ListSearch } from "@/components/list-search";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { parsePageParams } from "@/lib/pagination";
import { runPresumedPaidAction } from "@/features/billing/presumed-paid";
import { sendCollectionRemindersBatchAction } from "@/features/billing/reminder-actions";
import { hasPermission } from "@/lib/factory-roles";
import { redirect } from "next/navigation";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function CobranzaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = parsePageParams(sp);
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "collections.read")) redirect("/panel");
  const q = typeof sp?.q === "string" ? sp.q : undefined;
  const installmentsPage = await listAllInstallments(ctx, db, page, q);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobranza"
        description="Cuotas de pago de la cartera de pólizas. La presunción PAC/PAT nace apagada."
      />
      {typeof sp?.presunta === "string" ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          {sp.omitida === "1"
            ? "La presunción PAC/PAT está apagada. No se marcó ninguna cuota."
            : `Se marcaron ${sp.presunta} cuotas como presunta pagada.`}
        </p>
      ) : null}
      {typeof sp?.recordatorios === "string" ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          Se enviaron {sp.recordatorios} recordatorios. Se omitieron{" "}
          {typeof sp.omitidos === "string" ? sp.omitidos : "0"} cuotas sin
          destinatario, no elegibles o ya notificadas hoy.
        </p>
      ) : null}
      {hasPermission(ctx.role, "installments.mark_paid") ? (
        <form action={runPresumedPaidAction}>
          <button
            type="submit"
            className="rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            Revisar cuotas PAC y PAT
          </button>
        </form>
      ) : null}
      {hasPermission(ctx.role, "collections.send_reminders") ? (
        <form action={sendCollectionRemindersBatchAction}>
          <button
            type="submit"
            className="rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            Enviar recordatorios pendientes
          </button>
        </form>
      ) : null}
      <ListSearch placeholder="Buscar por N° de póliza o cliente…" />
      {installmentsPage.rows.length === 0 && !installmentsPage.prevCursor && !q ? (
        <EmptyState
          icon={Wallet}
          title="Sin cuotas registradas"
          description="Genera un plan de cuotas desde la pestaña Cobranza de una póliza."
        />
      ) : (
        <>
          <CobranzaOverview
            installments={installmentsPage.rows}
            canMarkPaid={hasPermission(ctx.role, "installments.mark_paid")}
            canSendReminders={hasPermission(
              ctx.role,
              "collections.send_reminders",
            )}
            canReadSensitive={hasPermission(
              ctx.role,
              "parties.read_sensitive",
            )}
          />
          <Pager
            page={installmentsPage}
            baseHref="/cobranza"
            searchParams={sp}
            itemLabel="cuotas"
          />
        </>
      )}
    </div>
  );
}
