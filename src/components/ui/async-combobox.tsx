"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
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
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              items.map((opt) => (
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
              ))
            )}
          </CommandList>
          {footer && <div className="border-t p-1">{footer}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
