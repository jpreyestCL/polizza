import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProposalsViewSwitch({
  view,
  searchParams,
}: {
  view: "kanban" | "lista";
  searchParams: Record<string, string | string[] | undefined> | undefined;
}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (k === "view" || k === "cursor" || k === "dir") continue;
    if (typeof v === "string" && v.length > 0) sp.set(k, v);
  }
  const kanbanHref = sp.toString()
    ? `/propuestas?${sp.toString()}`
    : "/propuestas";
  const listSp = new URLSearchParams(sp);
  listSp.set("view", "lista");
  const listHref = `/propuestas?${listSp.toString()}`;

  return (
    <div className="flex gap-1">
      <Button
        asChild
        variant={view === "kanban" ? "default" : "outline"}
        size="sm"
      >
        <Link href={kanbanHref}>
          <LayoutGrid />
          Kanban
        </Link>
      </Button>
      <Button
        asChild
        variant={view === "lista" ? "default" : "outline"}
        size="sm"
      >
        <Link href={listHref}>
          <List />
          Lista
        </Link>
      </Button>
    </div>
  );
}
