import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { requireSession } from "@/server/context";
import { basePrisma } from "@/server/db";
import { roleLabel } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileNameForm } from "@/features/account/components/profile-name-form";
import { EmailForm } from "@/features/account/components/email-form";
import { PasswordForm } from "@/features/account/components/password-form";

export const metadata: Metadata = { title: "Mi perfil" };

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;
  const justConfirmed = sp?.correo === "confirmado";

  const user = await basePrisma.user.findUnique({
    where: { id: ctx.userId },
    select: { emailVerified: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mi perfil"
        description={`${ctx.organizationName} · ${roleLabel(ctx.role)}`}
        actions={<SignOutButton />}
      />

      {justConfirmed && (
        <div className="flex max-w-2xl gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Listo: tu correo de acceso ahora es{" "}
            <span className="font-medium">{ctx.email}</span>.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Datos de la cuenta</h2>
        <ProfileNameForm initialName={ctx.userName} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Correo de acceso</h2>
        <EmailForm
          currentEmail={ctx.email}
          emailVerified={Boolean(user?.emailVerified)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Contraseña</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
