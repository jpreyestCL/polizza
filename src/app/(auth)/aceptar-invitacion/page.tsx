"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AceptarInvitacionPage() {
  return (
    <Suspense fallback={<Centered />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}

function Centered() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="animate-spin text-muted-foreground" />
    </div>
  );
}

type InvitationInfo = { email: string; organizationName: string };

function AcceptInvitationContent() {
  const router = useRouter();
  const invitationId = useSearchParams().get("id");
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    "loading",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!invitationId) {
      setStatus("notfound");
      return;
    }
    let active = true;
    authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then((res) => {
        if (!active) return;
        const data = res.data as Record<string, string> | null;
        if (res.error || !data) {
          setStatus("notfound");
          return;
        }
        setInvitation({
          email: data.email,
          organizationName: data.organizationName ?? "la corredora",
        });
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("notfound");
      });
    return () => {
      active = false;
    };
  }, [invitationId]);

  async function acceptAsExistingUser() {
    if (!invitationId) return;
    setSubmitting(true);
    const res = await authClient.organization.acceptInvitation({
      invitationId,
    });
    setSubmitting(false);
    if (res.error) {
      toast.error("No pudimos aceptar la invitación");
      return;
    }
    toast.success("Te uniste a la corredora");
    router.push("/");
    router.refresh();
  }

  async function signUpAndAccept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitationId || !invitation) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setSubmitting(true);
    const signUp = await authClient.signUp.email({
      name,
      email: invitation.email,
      password,
    });
    if (signUp.error) {
      setSubmitting(false);
      toast.error("No pudimos crear tu cuenta");
      return;
    }
    const res = await authClient.organization.acceptInvitation({
      invitationId,
    });
    setSubmitting(false);
    if (res.error) {
      toast.error("Cuenta creada, pero no pudimos aceptar la invitación");
      return;
    }
    toast.success("¡Bienvenido a Polizza!");
    router.push("/");
    router.refresh();
  }

  if (status === "loading" || sessionPending) return <Centered />;

  if (status === "notfound" || !invitation) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-semibold">Invitación no válida</h1>
        <p className="text-sm text-muted-foreground">
          El enlace no es válido o ya expiró. Pide a tu administrador que te
          invite nuevamente.
        </p>
        <Button asChild variant="outline">
          <Link href="/login">Ir a inicio de sesión</Link>
        </Button>
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Aceptar invitación
          </h1>
          <p className="text-sm text-muted-foreground">
            Te invitaron a unirte a{" "}
            <strong className="text-foreground">
              {invitation.organizationName}
            </strong>
            .
          </p>
        </div>
        <Button
          className="w-full"
          onClick={acceptAsExistingUser}
          disabled={submitting}
        >
          {submitting && <Loader2 className="animate-spin" />}
          Unirme a la corredora
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Crea tu cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Te invitaron a{" "}
          <strong className="text-foreground">
            {invitation.organizationName}
          </strong>
          . Crea tu cuenta para entrar.
        </p>
      </div>
      <form onSubmit={signUpAndAccept} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" value={invitation.email} readOnly disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Tu nombre</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Crear cuenta y entrar
        </Button>
      </form>
    </div>
  );
}
