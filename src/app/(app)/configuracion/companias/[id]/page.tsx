import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";
import { requireOrgDb } from "@/server/context";
import { getTenantCompany } from "@/features/tenant-config/queries";
import { TenantCompanyDetailPanel } from "@/features/tenant-config/components/tenant-company-detail-panel";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export default async function ConfiguracionCompaniaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db } = await requireOrgDb();
  const { id } = await params;
  const company = await getTenantCompany(db, id);
  if (!company) notFound();
  const isCustom = company.globalCompanyId === null;
  const merged = {
    id: company.id,
    isCustom,
    name: company.globalCompany?.name ?? company.name,
    legalName: company.globalCompany?.legalName ?? company.legalName,
    rut: company.globalCompany?.rut ?? company.rut,
    address: company.globalCompany?.address ?? company.address,
    commune: company.globalCompany?.commune ?? company.commune,
    city: company.globalCompany?.city ?? company.city,
    url: company.globalCompany?.url ?? company.url,
    isLife: company.globalCompany?.isLife ?? company.isLife,
    brokerCode: company.brokerCode,
    paymentLink: company.paymentLink,
    bankAccountClp: company.bankAccountClp,
    bankAccountUsd: company.bankAccountUsd,
    defaultEmail: company.defaultEmail,
    status: company.status,
  };
  return (
    <div className="space-y-6">
      <Link
        href="/configuracion/companias"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Compañías
      </Link>
      <PageHeader
        title={merged.name}
        description={merged.legalName ?? merged.rut ?? undefined}
        actions={
          isCustom ? (
            <Badge variant="outline">Custom</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Globe className="size-3" /> Global
            </Badge>
          )
        }
      />
      <TenantCompanyDetailPanel
        company={merged}
        contacts={company.contacts.map((c) => ({
          id: c.id,
          name: c.name,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          celular: c.celular,
          role: c.role,
          isDefault: c.isDefault,
        }))}
      />
    </div>
  );
}
