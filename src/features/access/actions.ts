"use server";

import { cookies } from "next/headers";
import { requireSession } from "@/server/context";
import { basePrisma } from "@/server/db";
import { secondFactorStep } from "@/lib/domain/access-gate";
import { otpauthUrl, randomBase32, totpMatches } from "@/server/totp";
import { logAudit } from "@/server/activity";

const COOKIE = "polizza_mfa";

async function mfaRequiredForUser(userId: string): Promise<boolean> {
  const members = await basePrisma.member.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  if (members.length === 0) return false;
  const settings = await basePrisma.organizationSettings.findMany({
    where: { organizationId: { in: members.map((row) => row.organizationId) } },
    select: { mfaRequired: true },
  });
  return settings.some((row) => row.mfaRequired);
}

export async function beginSecondFactorAction(): Promise<
  | { step: "app" }
  | { step: "totp" }
  | { step: "enroll"; otpauth: string }
> {
  const ctx = await requireSession();
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "auth.login.success",
  });
  const required = await mfaRequiredForUser(ctx.userId);
  const enrollment = await basePrisma.mfaEnrollment.findUnique({
    where: { userId: ctx.userId },
  });
  const step = secondFactorStep({
    mfaRequired: required,
    enrolled: Boolean(enrollment?.enabled),
  });
  const jar = await cookies();
  if (step === "app") {
    jar.set(COOKIE, "ok", { httpOnly: true, sameSite: "lax", path: "/" });
    return { step: "app" };
  }
  jar.set(COOKIE, "pending", { httpOnly: true, sameSite: "lax", path: "/" });
  if (step === "totp") return { step: "totp" };
  const secret = enrollment?.secretBase32 ?? randomBase32();
  if (!enrollment) {
    await basePrisma.mfaEnrollment.create({
      data: { userId: ctx.userId, secretBase32: secret, enabled: false },
    });
  }
  return { step: "enroll", otpauth: otpauthUrl(secret, ctx.email) };
}

export async function confirmSecondFactorAction(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireSession();
  const enrollment = await basePrisma.mfaEnrollment.findUnique({
    where: { userId: ctx.userId },
  });
  if (!enrollment || !totpMatches(enrollment.secretBase32, code)) {
    return { ok: false, error: "El código no coincide." };
  }
  if (!enrollment.enabled) {
    await basePrisma.mfaEnrollment.update({
      where: { userId: ctx.userId },
      data: { enabled: true },
    });
    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "mfa.enrolled",
      metadata: { method: "totp" },
    });
  }
  const jar = await cookies();
  jar.set(COOKIE, "ok", { httpOnly: true, sameSite: "lax", path: "/" });
  await logAudit({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "mfa.verified",
    metadata: { method: "totp" },
  });
  return { ok: true };
}

/**
 * Opciones de acceso corporativo para el correo ingresado. No devuelve datos
 * de la cuenta y los proveedores solo aparecen si la corredora los habilitó.
 */
export async function getSignInOptionsAction(email: string): Promise<{
  google: boolean;
  microsoft: boolean;
}> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { google: false, microsoft: false };
  const user = await basePrisma.user.findUnique({
    where: { email: normalized },
    select: {
      members: {
        select: { organizationId: true },
      },
    },
  });
  if (!user?.members.length) return { google: false, microsoft: false };
  const enabled = await basePrisma.organizationSettings.findFirst({
    where: {
      organizationId: { in: user.members.map((row) => row.organizationId) },
      ssoEnabled: true,
    },
    select: { organizationId: true },
  });
  if (!enabled) return { google: false, microsoft: false };
  return {
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    microsoft: Boolean(
      process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
    ),
  };
}
