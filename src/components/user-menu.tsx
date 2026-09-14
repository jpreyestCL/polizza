"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  userName,
  email,
  role,
  isSuperadmin = false,
}: {
  userName: string;
  email: string;
  role: string;
  isSuperadmin?: boolean;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Abrir menú de usuario"
        className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-accent sm:pr-2.5"
      >
        <Avatar className="size-7">
          <AvatarFallback className="text-xs">
            {initials(userName)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate font-medium text-foreground sm:block">
          {userName}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium text-foreground">{userName}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
          <div className="mt-1 text-xs font-medium text-primary">
            {roleLabel(role)}
            {isSuperadmin && (
              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                SaaS admin
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/perfil")}>
          <UserRound />
          Mi perfil
        </DropdownMenuItem>
        {isSuperadmin && (
          <DropdownMenuItem onSelect={() => router.push("/admin")}>
            <ShieldCheck />
            Panel SaaS Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
