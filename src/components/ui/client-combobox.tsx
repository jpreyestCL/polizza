"use client";

import { useCallback } from "react";
import { AsyncCombobox, type ComboOption } from "./async-combobox";

type Client = { id: string; name: string; rut?: string | null };

type Props = {
  value: string;
  onChange: (id: string, client: Client | null) => void;
  initial?: Client | null;
  placeholder?: string;
  disabled?: boolean;
};

export function ClientCombobox({
  value,
  onChange,
  initial,
  placeholder = "Buscar contratante por nombre o RUT",
  disabled,
}: Props) {
  const fetcher = useCallback(async (q: string): Promise<ComboOption[]> => {
    const url = `/api/clients/search?q=${encodeURIComponent(q)}&limit=20`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { items: Client[] };
    return json.items.map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: c.rut ?? undefined,
    }));
  }, []);

  return (
    <AsyncCombobox
      value={value}
      onChange={(id, opt) =>
        onChange(
          id,
          opt
            ? { id: opt.id, name: opt.label, rut: opt.sublabel ?? null }
            : null,
        )
      }
      initialOption={
        initial
          ? { id: initial.id, label: initial.name, sublabel: initial.rut }
          : null
      }
      fetcher={fetcher}
      placeholder={placeholder}
      searchPlaceholder="Buscar por nombre o RUT"
      emptyText="Sin coincidencias"
      disabled={disabled}
    />
  );
}
