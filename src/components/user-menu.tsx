"use client";

import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
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
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <Avatar className="size-8">
          <AvatarFallback>{initials(userName)}</AvatarFallback>
        </Avatar>
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
        {isSuperadmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/admin")}>
              <ShieldCheck />
              Panel SaaS Admin
            </DropdownMenuItem>
          </>
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
