import type { Metadata } from "next";
import { requireSession } from "@/server/context";
import { roleLabel } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileNameForm } from "@/features/account/components/profile-name-form";
import { PasswordForm } from "@/features/account/components/password-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PerfilPage() {
  const ctx = await requireSession();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mi perfil"
        description={`${ctx.organizationName} · ${roleLabel(ctx.role)}`}
        actions={<SignOutButton />}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Datos de la cuenta</h2>
        <ProfileNameForm initialName={ctx.userName} email={ctx.email} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Contraseña</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
