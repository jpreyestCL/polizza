import Link from "next/link";
import { Building2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PolicyListItem } from "../queries";
import type { CatalogItem } from "@/features/catalog/queries";
import { RENEWAL_STATUS_LABELS } from "@/lib/domain/renewal-status";
import { PolicyRenewalBadge } from "./policy-badges";
import { RenewPolicyButton } from "./renew-policy-button";
import { quoteRenewalAction } from "../actions";

export function RenewalsList({
  policies,
  companies,
}: {
  policies: PolicyListItem[];
  companies: CatalogItem[];
}) {
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <ul className="space-y-3">
      {policies.map((policy) => (
        <li
          key={policy.id}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/polizas/${policy.id}`}
                className="font-medium hover:text-primary"
              >
                {policy.policyNumber}
              </Link>
              <PolicyRenewalBadge
                level={policy.renewalLevel}
                days={policy.daysToExpiry}
              />
              <span className="text-xs text-muted-foreground">
                {RENEWAL_STATUS_LABELS[policy.renewalStatus]}
                {policy.quoting ? " · cotizando" : ""}
                {policy.renewalRisk === "AT_RISK" ? " · en riesgo" : ""}
                {policy.renewalRisk === "OVERDUE" ? " · vencida" : ""}
              </span>
            </div>
            <p className="text-sm">{policy.client.name}</p>
            <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {policy.companyId && companyName.has(policy.companyId) && (
                <span className="flex items-center gap-1">
                  <Building2 className="size-3" />
                  {companyName.get(policy.companyId)}
                </span>
              )}
              <span>Vence el {formatDate(policy.endDate)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={quoteRenewalAction}>
              <input type="hidden" name="policyId" value={policy.id} />
              <button type="submit" className="rounded-md border px-3 py-2 text-sm">
                Recotizar
              </button>
            </form>
            <RenewPolicyButton
              policyId={policy.id}
              policyNumber={policy.policyNumber}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
