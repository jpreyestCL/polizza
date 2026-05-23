"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Layers, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/companias", label: "Compañías", icon: Building2 },
  { href: "/admin/ramos", label: "Ramos", icon: Layers },
  { href: "/admin/productos", label: "Productos", icon: Package },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
