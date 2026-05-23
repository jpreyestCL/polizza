import { Logo } from "@/components/brand";
import { AppNav } from "@/components/app-nav";

export function AppSidebar({ role }: { role?: string }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Logo className="size-7" />
        <span className="font-semibold tracking-tight text-sidebar-foreground">
          Polizza
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
          Operación
        </p>
        <AppNav role={role} />
      </div>
      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-foreground/45">
        MVP 1 · Clientes 360°
      </div>
    </aside>
  );
}
