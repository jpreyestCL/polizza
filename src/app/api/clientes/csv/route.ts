import { requireOrgDb } from "@/server/context";
import { hasPermission } from "@/lib/factory-roles";
import {
  clientListWhere,
  getOrgMembers,
  type ClientListFilters,
} from "@/features/clients/queries";
import { formatRut } from "@/lib/rut";
import {
  maskAddress,
  maskEmail,
  maskPhone,
} from "@/features/clients/privacy";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const { ctx, db } = await requireOrgDb();
  if (!hasPermission(ctx.role, "parties.export")) {
    return new Response("PERMISSION_DENIED", { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const status = params.get("status");
  let filters: ClientListFilters = {
    q: params.get("q") || undefined,
    type: type === "PERSONA" || type === "EMPRESA" ? type : undefined,
    status:
      status === "PROSPECTO" || status === "ACTIVO" || status === "INACTIVO"
        ? status
        : undefined,
    assignedUserId: params.get("ejecutivo") || undefined,
    branchTypeId: params.get("ramo") || undefined,
    tagId: params.get("tag") || undefined,
    sort: params.get("sort") === "name" ? "name" : undefined,
    order: params.get("order") === "desc" ? "desc" : "asc",
  };
  if (filters.branchTypeId) {
    const products = await db.insuranceProduct.findMany({
      where: { branchTypeId: filters.branchTypeId },
      select: { id: true },
    });
    filters = { ...filters, branchProductIds: products.map((product) => product.id) };
  }
  const order =
    filters.sort === "name"
      ? [{ name: filters.order }, { id: filters.order }]
      : [{ createdAt: "desc" as const }, { id: "desc" as const }];
  const [clients, members] = await Promise.all([
    db.client.findMany({
      where: clientListWhere(ctx, filters),
      orderBy: order,
      select: {
        name: true,
        type: true,
        rut: true,
        status: true,
        email: true,
        phone: true,
        celular: true,
        address: true,
        region: true,
        commune: true,
        assignedUserId: true,
        tagAssignments: { select: { tag: { select: { name: true } } } },
      },
    }),
    getOrgMembers(ctx.organizationId),
  ]);
  const memberNames = new Map(members.map((member) => [member.userId, member.name]));
  const canReadSensitive = hasPermission(ctx.role, "parties.read_sensitive");
  const header = [
    "Nombre", "Tipo", "RUT", "Estado", "Correo", "Teléfono", "Celular",
    "Dirección", "Región", "Comuna", "Ejecutivo", "Tags",
  ];
  const lines = clients.map((client) =>
    [
      client.name,
      client.type === "PERSONA" ? "Persona" : "Empresa",
      formatRut(client.rut),
      client.status,
      canReadSensitive ? client.email : maskEmail(client.email),
      canReadSensitive ? client.phone : maskPhone(client.phone),
      canReadSensitive ? client.celular : maskPhone(client.celular),
      canReadSensitive ? client.address : maskAddress(client.address),
      client.region,
      client.commune,
      client.assignedUserId ? memberNames.get(client.assignedUserId) : "",
      client.tagAssignments.map(({ tag }) => tag.name).join("; "),
    ].map(csvCell).join(","),
  );
  return new Response(`\uFEFF${[header.map(csvCell).join(","), ...lines].join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clientes.csv"',
    },
  });
}
