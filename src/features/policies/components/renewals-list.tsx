import Link from "next/link";
import { Building2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PolicyListItem } from "../queries";
import type { CatalogItem } from "@/features/catalog/queries";
import { PolicyRenewalBadge } from "./policy-badges";
import { RenewPolicyButton } from "./renew-policy-button";

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
          <RenewPolicyButton
            policyId={policy.id}
            policyNumber={policy.policyNumber}
          />
        </li>
      ))}
    </ul>
  );
}
