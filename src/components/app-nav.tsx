"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Layers,
  FileText,
  ShieldCheck,
  RefreshCw,
  TriangleAlert,
  Wallet,
  ListChecks,
  LayoutDashboard,
  Car,
  KeyRound,
  Building2,
  Package,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  available: boolean;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/clientes", label: "Clientes", icon: Users, available: true },
  { href: "/holdings", label: "Holdings", icon: Layers, available: true },
  { href: "/panel", label: "Dashboard", icon: LayoutDashboard, available: true },
  { href: "/cotizaciones", label: "Cotizaciones auto", icon: Car, available: true },
  { href: "/propuestas", label: "Propuestas", icon: FileText, available: true },
  { href: "/polizas", label: "Pólizas", icon: ShieldCheck, available: true },
  {
    href: "/renovaciones",
    label: "Renovaciones",
    icon: RefreshCw,
    available: true,
  },
  {
    href: "/siniestros",
    label: "Siniestros",
    icon: TriangleAlert,
    available: true,
  },
  { href: "/cobranza", label: "Cobranza", icon: Wallet, available: true },
  { href: "/tareas", label: "Tareas", icon: ListChecks, available: true },
  {
    href: "/configuracion/companias",
    label: "Compañías",
    icon: Building2,
    available: true,
    adminOnly: true,
  },
  {
    href: "/configuracion/productos",
    label: "Productos",
    icon: Package,
    available: true,
    adminOnly: true,
  },
  {
    href: "/configuracion/portales",
    label: "Portales aseguradoras",
    icon: KeyRound,
    available: true,
    adminOnly: true,
  },
];

export function AppNav({
  onNavigate,
  role,
}: {
  onNavigate?: () => void;
  role?: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || role === "admin",
  );

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = item.icon;

        if (!item.available) {
          return (
            <span
              key={item.href}
              className="flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/40"
            >
              <Icon className="size-4" />
              {item.label}
              <span className="ml-auto text-[10px] font-medium uppercase tracking-wide">
                Pronto
              </span>
            </span>
          );
        }

        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
