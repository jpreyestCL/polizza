import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { basePrisma } from "@/server/db";
import { ac, roles } from "@/lib/permissions";
import { sendEmail, emailLayout } from "@/server/email";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(basePrisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Recupera tu contraseña — Polizza",
        text: `Para restablecer tu contraseña entra a: ${url}`,
        html: emailLayout(
          "Recupera tu contraseña",
          "Recibimos una solicitud para restablecer la contraseña de tu cuenta.",
          { label: "Restablecer contraseña", url },
        ),
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "admin",
      sendInvitationEmail: async (data) => {
        const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/aceptar-invitacion?id=${data.id}`;
        await sendEmail({
          to: data.email,
          subject: `Invitación a ${data.organization.name} — Polizza`,
          text: `Te invitaron a unirte a ${data.organization.name} en Polizza. Acepta aquí: ${url}`,
          html: emailLayout(
            `Invitación a ${data.organization.name}`,
            `${data.inviter.user.name} te invitó a unirte a la corredora <strong>${data.organization.name}</strong> en Polizza.`,
            { label: "Aceptar invitación", url },
          ),
        });
      },
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
