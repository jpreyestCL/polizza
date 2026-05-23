"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { bootstrapOrganizationAction } from "@/features/organizations/actions";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegistroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const company = String(form.get("company") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    const signUp = await authClient.signUp.email({ name, email, password });
    if (signUp.error) {
      setLoading(false);
      toast.error("No pudimos crear tu cuenta", {
        description: "Es posible que el correo ya esté registrado.",
      });
      return;
    }

    const slug = `${slugify(company) || "corredora"}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const org = await authClient.organization.create({
      name: company,
      slug,
    });
    setLoading(false);

    if (org.error) {
      toast.error("Tu cuenta se creó, pero no pudimos crear la corredora", {
        description: "Inténtalo de nuevo desde la configuración.",
      });
      return;
    }

    try {
      await bootstrapOrganizationAction();
    } catch {
      // El catálogo base puede sembrarse luego; no bloquea el registro.
    }

    toast.success("¡Bienvenido a Polizza!");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Registra tu corredora
        </h1>
        <p className="text-sm text-muted-foreground">
          Crea tu cuenta y el espacio de trabajo de tu corredora.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Tu nombre</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Nombre de la corredora</Label>
          <Input
            id="company"
            name="company"
            placeholder="Corredora de Seguros Aconcagua"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@corredora.cl"
            required
          />
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
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Crear cuenta
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
