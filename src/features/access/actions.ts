"use server";

import { cookies } from "next/headers";
import { requireSession } from "@/server/context";
import { basePrisma } from "@/server/db";
import { secondFactorStep } from "@/lib/domain/access-gate";
import { otpauthUrl, randomBase32, totpMatches } from "@/server/totp";

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
  }
  const jar = await cookies();
  jar.set(COOKIE, "ok", { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}
