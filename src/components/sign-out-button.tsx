"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Cierra la sesión y vuelve al login. Se usa en el menú de usuario, en
 * /perfil y en la barra lateral del panel SaaS-admin.
 */
export function SignOutButton({
  variant = "outline",
  size,
  className,
  label = "Cerrar sesión",
}: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleSignOut}
      disabled={pending}
    >
      <LogOut />
      {pending ? "Cerrando…" : label}
    </Button>
  );
}
