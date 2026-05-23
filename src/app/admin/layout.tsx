import Link from "next/link";
import { requireSuperadmin } from "@/server/context";
import { AdminNav } from "./_nav";
import { ShieldCheck } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ctx } = await requireSuperadmin();
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <ShieldCheck className="size-6 text-amber-500" />
          <span className="font-semibold tracking-tight text-sidebar-foreground">
            SaaS Admin
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
            Catálogos globales
          </p>
          <AdminNav />
        </div>
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-foreground/45">
          {ctx.email}
          <div className="mt-1">
            <Link
              href="/panel"
              className="text-sidebar-foreground/70 underline-offset-2 hover:underline"
            >
              ← Volver al app
            </Link>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b bg-amber-50/40 px-5 dark:bg-amber-950/20">
          <div className="text-xs font-medium text-amber-900 dark:text-amber-300">
            Vista superadmin · estás administrando catálogos que ven todos los
            tenants
          </div>
        </header>
        <main className="flex-1 px-5 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
