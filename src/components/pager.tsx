import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHref, type Paginated } from "@/lib/pagination";

type Props<T extends { id: string }> = {
  page: Paginated<T>;
  baseHref: string;
  searchParams: Record<string, string | string[] | undefined> | undefined;
  /** Etiqueta singular para el contador (ej: "cliente"). */
  itemLabel?: string;
};

export function Pager<T extends { id: string }>({
  page,
  baseHref,
  searchParams,
  itemLabel,
}: Props<T>) {
  const prev = page.prevCursor
    ? { cursor: page.prevCursor, direction: "prev" as const }
    : null;
  const next = page.nextCursor
    ? { cursor: page.nextCursor, direction: "next" as const }
    : null;

  const totalLine = page.total !== undefined
    ? `${page.total.toLocaleString("es-CL")} ${itemLabel ?? "registros"}`
    : page.rows.length > 0
      ? `${page.rows.length} ${itemLabel ?? "en esta página"}`
      : "Sin resultados";

  return (
    <div className="flex items-center justify-between border-t border-border/60 px-2 py-3 text-sm text-muted-foreground">
      <span>{totalLine}</span>
      <div className="flex items-center gap-2">
        <Button
          asChild={Boolean(prev)}
          variant="outline"
          size="sm"
          disabled={!prev}
        >
          {prev ? (
            <Link href={pageHref(baseHref, searchParams, prev)}>
              <ChevronLeft />
              Anterior
            </Link>
          ) : (
            <span>
              <ChevronLeft />
              Anterior
            </span>
          )}
        </Button>
        <Button
          asChild={Boolean(next)}
          variant="outline"
          size="sm"
          disabled={!next}
        >
          {next ? (
            <Link href={pageHref(baseHref, searchParams, next)}>
              Siguiente
              <ChevronRight />
            </Link>
          ) : (
            <span>
              Siguiente
              <ChevronRight />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
