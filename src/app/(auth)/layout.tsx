import Link from "next/link";
import { Logo } from "@/components/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <main className="flex flex-col px-6 py-10 sm:px-12">
        <Link href="/login" className="flex items-center gap-2 font-semibold">
          <Logo className="size-8" />
          <span className="text-lg tracking-tight">Polizza</span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Polizza — gestión para corredoras de seguros chilenas
        </p>
      </main>

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-80 rounded-full bg-primary-foreground/10"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 size-96 rounded-full bg-primary-foreground/[0.07]"
        />
        <div className="relative">
          <p className="text-sm font-medium uppercase tracking-widest text-primary-foreground/70">
            Sistema operativo de la corredora
          </p>
        </div>
        <div className="relative space-y-4">
          <p className="text-balance text-2xl font-semibold leading-snug">
            Todo el ciclo del seguro, del lead a la renovación, en una sola
            plataforma.
          </p>
          <p className="text-sm leading-relaxed text-primary-foreground/75">
            Clientes, propuestas, pólizas, cartera y cobranza con estado,
            responsable y próxima acción siempre visibles.
          </p>
        </div>
        <div className="relative text-xs text-primary-foreground/60">
          Hecho para Chile: UF, RUT, ramos y compañías locales.
        </div>
      </aside>
    </div>
  );
}
