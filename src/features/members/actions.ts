"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgDb } from "@/server/context";
import { auth } from "@/server/auth";
import { logAudit } from "@/server/activity";
import {
  cancelOrgInvitation,
  listOrgMembers,
  removeOrgMember,
  updateOrgMemberRole,
} from "@/server/members";
import {
  FACTORY_ROLES,
  factoryRoleOf,
  hasPermission,
  type FactoryRole,
} from "@/lib/factory-roles";

const PAGE = "/configuracion/usuarios";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isFactoryRole(value: string): value is FactoryRole {
  return (FACTORY_ROLES as readonly string[]).includes(value);
}

async function requireUsersManager() {
  const { ctx } = await requireOrgDb();
  if (!hasPermission(ctx.role, "users.manage")) {
    redirect(`${PAGE}?aviso=permiso`);
  }
  return ctx;
}

/** No deja la corredora sin un administrador. */
async function wouldLeaveNoAdmin(
  organizationId: string,
  memberId: string,
  nextRole: FactoryRole | null,
): Promise<boolean> {
  if (nextRole === "ADMIN") return false;
  const members = await listOrgMembers(organizationId);
  const admins = members.filter(
    (member) =>
      factoryRoleOf(member.role) === "ADMIN" && member.memberId !== memberId,
  );
  return admins.length === 0;
}

export async function changeMemberRoleAction(form: FormData): Promise<void> {
  const ctx = await requireUsersManager();
  const memberId = text(form, "memberId");
  const role = text(form, "role");
  if (!memberId || !isFactoryRole(role)) redirect(`${PAGE}?aviso=rol`);
  if (await wouldLeaveNoAdmin(ctx.organizationId, memberId, role)) {
    redirect(`${PAGE}?aviso=ultimo-admin`);
  }
  const ok = await updateOrgMemberRole(ctx.organizationId, memberId, role);
  if (!ok) redirect(`${PAGE}?aviso=miembro`);
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "member.role_changed",
    metadata: { memberId, role },
  });
  revalidatePath(PAGE);
  redirect(`${PAGE}?aviso=rol-ok`);
}

export async function removeMemberAction(form: FormData): Promise<void> {
  const ctx = await requireUsersManager();
  const memberId = text(form, "memberId");
  const members = await listOrgMembers(ctx.organizationId);
  const target = members.find((member) => member.memberId === memberId);
  if (!target) redirect(`${PAGE}?aviso=miembro`);
  if (target.userId === ctx.userId) redirect(`${PAGE}?aviso=propio`);
  if (await wouldLeaveNoAdmin(ctx.organizationId, memberId, null)) {
    redirect(`${PAGE}?aviso=ultimo-admin`);
  }
  await removeOrgMember(ctx.organizationId, memberId);
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "member.removed",
    metadata: { memberId, email: target.email },
  });
  revalidatePath(PAGE);
  redirect(`${PAGE}?aviso=quitado`);
}

export async function inviteMemberAction(form: FormData): Promise<void> {
  const ctx = await requireUsersManager();
  const email = text(form, "email").toLowerCase();
  const role = text(form, "role");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !isFactoryRole(role)) {
    redirect(`${PAGE}?aviso=invitacion-datos`);
  }
  try {
    await auth.api.createInvitation({
      headers: await headers(),
      body: { email, role, organizationId: ctx.organizationId },
    });
  } catch (error) {
    console.error("[members] createInvitation failed", error);
    const status = (error as { body?: { message?: unknown } })?.body?.message;
    const detail = typeof status === "string" ? status : "";
    redirect(
      `${PAGE}?aviso=invitacion-error${detail ? `&detalle=${encodeURIComponent(detail)}` : ""}`,
    );
  }
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "member.invited",
    metadata: { email, role },
  });
  revalidatePath(PAGE);
  redirect(`${PAGE}?aviso=invitado`);
}

export async function cancelInvitationAction(form: FormData): Promise<void> {
  const ctx = await requireUsersManager();
  const invitationId = text(form, "invitationId");
  await cancelOrgInvitation(ctx.organizationId, invitationId);
  revalidatePath(PAGE);
  redirect(`${PAGE}?aviso=invitacion-cancelada`);
}
