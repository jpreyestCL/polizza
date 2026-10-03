import { hasPermission } from "@/lib/factory-roles";
import { logAudit } from "@/server/activity";
import { getSessionContext } from "@/server/context";
import { getDb } from "@/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext();
  if (!ctx) return new Response("No autenticado", { status: 401 });
  if (!hasPermission(ctx.role, "privacy.manage")) {
    return new Response("Sin permiso", { status: 403 });
  }
  const { id } = await params;
  const db = getDb(ctx.organizationId);
  const privacyRequest = await db.dataSubjectRequest.findFirst({
    where: { id },
    select: { id: true, clientId: true, type: true, status: true },
  });
  if (!privacyRequest) return new Response("No encontrado", { status: 404 });
  const client = await db.client.findFirst({
    where: { id: privacyRequest.clientId },
    include: {
      contacts: true,
      relationships: true,
      tagAssignments: true,
      proposals: true,
      policies: true,
      claims: true,
      privacyRequests: true,
    },
  });
  if (!client) return new Response("No encontrado", { status: 404 });
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "privacy_subject_exported",
    metadata: { requestId: privacyRequest.id, clientId: client.id },
  });
  return new Response(
    JSON.stringify(
      { exportedAt: new Date().toISOString(), request: privacyRequest, client },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="titular-${client.rut}.json"`,
      },
    },
  );
}
