"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  beginSecondFactorAction,
  confirmSecondFactorAction,
  getSignInOptionsAction,
} from "@/features/access/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const router = useRouter();
  const socialHandled = useRef(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"password" | "totp" | "enroll">("password");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [sso, setSso] = useState({ google: false, microsoft: false });

  async function continueAfterLogin() {
    const next = await beginSecondFactorAction();
    if (next.step === "app") {
      router.push("/");
      router.refresh();
      return;
    }
    if (next.step === "enroll") setOtpauth(next.otpauth);
    setStep(next.step);
  }

  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("social") !== "1" ||
      socialHandled.current
    ) {
      return;
    }
    socialHandled.current = true;
    void continueAfterLogin();
    // Solo se procesa una vez al volver del proveedor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);

    if (error) {
      toast.error("No pudimos iniciar sesión", {
        description: "Revisa tu correo y contraseña.",
      });
      return;
    }
    await continueAfterLogin();
  }

  async function confirmCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const result = await confirmSecondFactorAction(code);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Entra a Polizza
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresa con tu cuenta de corredora.
        </p>
      </div>

      {step !== "password" ? (
        <form onSubmit={confirmCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {step === "enroll"
              ? "Esta corredora pide un segundo factor. Agrega esta clave en tu aplicación de códigos y confirma con el primer código."
              : "Ingresa el código de 6 dígitos."}
          </p>
          {step === "enroll" && otpauth ? (
            <p className="break-all rounded-md border bg-muted/40 p-2 text-xs">{otpauth}</p>
          ) : null}
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Confirmar código
          </Button>
        </form>
      ) : null}

      {step === "password" && (sso.google || sso.microsoft) ? (
        <div className="space-y-2">
          {sso.google ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                authClient.signIn.social({
                  provider: "google",
                  callbackURL: "/login?social=1",
                })
              }
            >
              Entrar con Google
            </Button>
          ) : null}
          {sso.microsoft ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                authClient.signIn.social({
                  provider: "microsoft",
                  callbackURL: "/login?social=1",
                })
              }
            >
              Entrar con Microsoft
            </Button>
          ) : null}
        </div>
      ) : null}

      {step === "password" ? (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@corredora.cl"
            required
            onBlur={async (event) => {
              setSso(await getSignInOptionsAction(event.currentTarget.value));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <ForgotPasswordDialog />
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Entrar
        </Button>
      </form>
      ) : null}

      <p className="text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          href="/registro"
          className="font-medium text-primary hover:underline"
        >
          Registra tu corredora
        </Link>
      </p>
    </div>
  );
}

function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setLoading(true);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/restablecer",
    });
    setLoading(false);
    if (error) {
      toast.error("No pudimos enviar el correo");
      return;
    }
    setOpen(false);
    toast.success("Revisa tu correo", {
      description: "Te enviamos un enlace para restablecer tu contraseña.",
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Te enviaremos un enlace para crear una nueva contraseña.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">Correo</Label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              placeholder="tu@corredora.cl"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Enviar enlace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
