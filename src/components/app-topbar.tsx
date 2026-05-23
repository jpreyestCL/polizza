"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { formatClp } from "@/lib/uf";
import { AppNav } from "@/components/app-nav";
import { GlobalSearch } from "@/components/global-search";
import { UserMenu } from "@/components/user-menu";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AppTopbar({
  userName,
  email,
  organizationName,
  role,
  ufValue,
  usdObsValue,
  euroValue,
  isSuperadmin = false,
}: {
  userName: string;
  email: string;
  organizationName: string;
  role: string;
  ufValue: number | null;
  usdObsValue?: number | null;
  euroValue?: number | null;
  isSuperadmin?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6">
      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menú"
          >
            <Menu />
          </Button>
        </DialogTrigger>
        <DialogContent className="left-0 top-0 h-svh max-w-64 translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 bg-sidebar p-0">
          <DialogTitle className="sr-only">Navegación</DialogTitle>
          <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
            <Logo className="size-7" />
            <span className="font-semibold tracking-tight text-sidebar-foreground">
              Polizza
            </span>
          </div>
          <div className="p-3">
            <AppNav onNavigate={() => setNavOpen(false)} role={role} />
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 justify-start">
        <GlobalSearch />
      </div>

      <div className="hidden items-center gap-1.5 sm:flex">
        {ufValue !== null && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground"
            title="Valor de la UF de hoy"
          >
            <span className="font-semibold text-foreground">UF</span>
            {formatClp(ufValue)}
          </span>
        )}
        {usdObsValue != null && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground"
            title="Dólar Observado"
          >
            <span className="font-semibold text-foreground">USD</span>
            {formatClp(usdObsValue)}
          </span>
        )}
        {euroValue != null && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground"
            title="Euro"
          >
            <span className="font-semibold text-foreground">€</span>
            {formatClp(euroValue)}
          </span>
        )}
      </div>
      <span className="hidden max-w-44 truncate text-sm text-muted-foreground lg:block">
        {organizationName}
      </span>
      <UserMenu
        userName={userName}
        email={email}
        role={role}
        isSuperadmin={isSuperadmin}
      />
    </header>
  );
}
