"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ComboOption = {
  id: string;
  label: string;
  sublabel?: string | null;
};

type Props = {
  value: string;
  onChange: (id: string, option: ComboOption | null) => void;
  fetcher: (query: string) => Promise<ComboOption[]>;
  initialOption?: ComboOption | null;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  footer?: React.ReactNode;
  className?: string;
  /** Si se entrega, muestra un botón "Agregar" en el empty state (y al final
   *  de la lista) que llama `onCreate(query)`. Cierra el popover al gatillarse. */
  onCreate?: (query: string) => void;
  /** Texto del botón. Default: "Agregar". */
  createLabel?: string;
};

export function AsyncCombobox({
  value,
  onChange,
  fetcher,
  initialOption,
  placeholder = "Seleccionar…",
  emptyText = "Sin resultados",
  searchPlaceholder = "Buscar…",
  disabled,
  footer,
  className,
  onCreate,
  createLabel = "Agregar",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ComboOption[]>(
    initialOption ? [initialOption] : [],
  );
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ComboOption | null>(
    initialOption ?? null,
  );
  const reqId = useRef(0);

  useEffect(() => {
    if (initialOption && initialOption.id === value) setSelected(initialOption);
  }, [initialOption, value]);

  useEffect(() => {
    if (!open) return;
    const my = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await fetcher(query);
        if (reqId.current === my) setItems(rows);
      } finally {
        if (reqId.current === my) setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open, fetcher]);

  const display = useMemo(() => {
    if (selected) return selected.label;
    return placeholder;
  }, [selected, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Buscando…
              </div>
            ) : items.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                {emptyText}
                {onCreate && (
                  <div className="mt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        onCreate(query.trim());
                        setOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <Plus className="size-3.5" />
                      {createLabel}
                      {query.trim() && (
                        <span className="ml-1 max-w-[180px] truncate font-normal text-muted-foreground">
                          “{query.trim()}”
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {items.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.id}
                    onSelect={() => {
                      setSelected(opt);
                      onChange(opt.id, opt);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === opt.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="truncate text-xs text-muted-foreground">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
                {onCreate && (
                  <div className="border-t p-1">
                    <button
                      type="button"
                      onClick={() => {
                        onCreate(query.trim());
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                      {createLabel}
                      {query.trim() && (
                        <span className="ml-1 max-w-[200px] truncate">
                          “{query.trim()}”
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </CommandList>
          {footer && <div className="border-t p-1">{footer}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
