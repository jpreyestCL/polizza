"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import type { BranchFieldDef } from "../queries";

const RICHTEXT_KEY_HINTS = [
  "materiaasegurada",
  "materia_asegurada",
  "subjectmatter",
  "subject_matter",
];
const COMMUNE_KEYS = ["comuna", "commune"];
const CITY_KEYS = ["ciudad", "city"];

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[_\s-]/g, "");
}

function isRichTextField(f: BranchFieldDef): boolean {
  if (f.type === "richtext") return true;
  return RICHTEXT_KEY_HINTS.includes(normalizeKey(f.fieldKey));
}

function isCommuneField(f: BranchFieldDef): boolean {
  return COMMUNE_KEYS.includes(normalizeKey(f.fieldKey));
}

function isCityField(f: BranchFieldDef): boolean {
  return CITY_KEYS.includes(normalizeKey(f.fieldKey));
}

// Campos de vehículo con autocompletado contra maestros globales.
// Sólo se aplica a campos `text` exactos (no afecta `tipo_inmueble`,
// `tipo_nave`, etc. que son selects con enum cerrado).
function isVehicleBrandField(f: BranchFieldDef): boolean {
  return f.type === "text" && normalizeKey(f.fieldKey) === "marca";
}

function isVehicleModelField(f: BranchFieldDef): boolean {
  return f.type === "text" && normalizeKey(f.fieldKey) === "modelo";
}

function isVehicleTypeField(f: BranchFieldDef): boolean {
  return f.type === "text" && normalizeKey(f.fieldKey) === "tipo";
}

export function DynamicFieldForm({
  fields,
  values,
  onChange,
}: {
  fields: BranchFieldDef[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  function setField(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }
  function setFields(patch: Record<string, unknown>) {
    onChange({ ...values, ...patch });
  }

  // Pareo comuna -> ciudad: si existe un campo ciudad junto a comuna, ciudad
  // se vuelve sólo lectura y la asigna el combobox de comunas.
  const hasCityField = fields.some(isCityField);
  const cityField = fields.find(isCityField);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const isRich = isRichTextField(f);
        const isCommune = isCommuneField(f);
        const isCity = isCityField(f);
        const isBrand = isVehicleBrandField(f);
        const isModel = isVehicleModelField(f);
        const isType = isVehicleTypeField(f);
        return (
          <div
            key={f.id}
            className={
              f.type === "textarea" || isRich
                ? "sm:col-span-2"
                : ""
            }
          >
            <Label className="text-xs">
              {f.label}
              {f.required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            {isRich ? (
              <RichTextEditor
                value={(values[f.fieldKey] as string) ?? ""}
                onChange={(v) => setField(f.fieldKey, v)}
                minHeightClass="min-h-[120px]"
              />
            ) : isCommune ? (
              <CommuneCombobox
                value={(values[f.fieldKey] as string) ?? ""}
                onChange={(name, city) => {
                  if (hasCityField && cityField) {
                    setFields({ [f.fieldKey]: name, [cityField.fieldKey]: city });
                  } else {
                    setField(f.fieldKey, name);
                  }
                }}
              />
            ) : isBrand ? (
              <FreeTextSearchCombobox
                value={(values[f.fieldKey] as string) ?? ""}
                onChange={(v) => {
                  if (v !== (values[f.fieldKey] as string)) {
                    // Al cambiar la marca, limpiamos el modelo seleccionado.
                    const next: Record<string, unknown> = {
                      ...values,
                      [f.fieldKey]: v,
                    };
                    if (fields.some(isVehicleModelField)) next.modelo = "";
                    onChange(next);
                  } else {
                    setField(f.fieldKey, v);
                  }
                }}
                endpoint="/api/vehicle-brands/search"
                placeholder="Buscar marca…"
              />
            ) : isModel ? (
              <FreeTextSearchCombobox
                value={(values[f.fieldKey] as string) ?? ""}
                onChange={(v) => setField(f.fieldKey, v)}
                endpoint="/api/vehicle-models/search"
                extraParams={
                  values.marca && typeof values.marca === "string"
                    ? { brand: values.marca }
                    : undefined
                }
                placeholder="Buscar modelo…"
              />
            ) : isType ? (
              <FreeTextSearchCombobox
                value={(values[f.fieldKey] as string) ?? ""}
                onChange={(v) => setField(f.fieldKey, v)}
                endpoint="/api/vehicle-types/search"
                placeholder="Buscar tipo…"
              />
            ) : isCity ? (
              <Input
                value={(values[f.fieldKey] as string) ?? ""}
                onChange={(e) => setField(f.fieldKey, e.target.value)}
                readOnly={hasCityField && fields.some(isCommuneField)}
                placeholder={
                  fields.some(isCommuneField)
                    ? "Se asigna desde la comuna"
                    : ""
                }
              />
            ) : f.type === "select" && f.options ? (
              <Select
                value={(values[f.fieldKey] as string) ?? ""}
                onValueChange={(v) => setField(f.fieldKey, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.type === "textarea" ? (
              <Textarea
                rows={2}
                value={(values[f.fieldKey] as string) ?? ""}
                onChange={(e) => setField(f.fieldKey, e.target.value)}
              />
            ) : (
              <Input
                type={
                  f.type === "number"
                    ? "number"
                    : f.type === "date"
                      ? "date"
                      : "text"
                }
                value={(values[f.fieldKey] as string | number) ?? ""}
                onChange={(e) => setField(f.fieldKey, e.target.value)}
              />
            )}
            {f.helpText && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {f.helpText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Combobox que busca contra un endpoint de maestro y permite escribir un
 * valor libre (al hacer click en "Agregar 'X'" el valor escrito se asigna
 * tal cual al campo, sin tocar el maestro). La identidad del item es su
 * nombre, así que el `value` que se persiste es el string.
 */
function FreeTextSearchCombobox({
  value,
  onChange,
  endpoint,
  extraParams,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  endpoint: string;
  extraParams?: Record<string, string>;
  placeholder?: string;
}) {
  const [initial, setInitial] = useState<{
    id: string;
    label: string;
    sublabel?: string;
  } | null>(null);

  useEffect(() => {
    setInitial(value ? { id: value, label: value } : null);
  }, [value]);

  async function fetcher(q: string) {
    const params = new URLSearchParams({ q, limit: "30" });
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v);
      }
    }
    const res = await fetch(`${endpoint}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items: { id: string; name: string; brandName?: string }[];
    };
    return json.items.map((r) => ({
      id: r.name,
      label: r.name,
      sublabel: r.brandName ?? undefined,
    }));
  }

  return (
    <AsyncCombobox
      value={value}
      initialOption={initial}
      onChange={(id) => onChange(id)}
      fetcher={fetcher}
      placeholder={value || placeholder || "Seleccionar…"}
      searchPlaceholder="Buscar o escribir…"
      emptyText="No está en el maestro"
      onCreate={(q) => {
        if (!q) return;
        onChange(q);
      }}
      createLabel="Usar este valor"
    />
  );
}

function CommuneCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string, city: string) => void;
}) {
  type Row = { id: string; name: string; city: string; region: string };
  const [initial, setInitial] = useState<{ id: string; label: string; sublabel: string } | null>(
    null,
  );

  useEffect(() => {
    if (!value) {
      setInitial(null);
      return;
    }
    setInitial({ id: value, label: value, sublabel: "" });
  }, [value]);

  async function fetcher(q: string) {
    const url = `/api/communes/search?q=${encodeURIComponent(q)}&limit=30`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { items: Row[] };
    return json.items.map((r) => ({
      id: r.name,
      label: r.name,
      sublabel: `${r.city} · ${r.region}`,
      _city: r.city,
    }));
  }

  return (
    <AsyncCombobox
      value={value}
      initialOption={initial}
      onChange={(id, opt) => {
        const city =
          (opt as unknown as { _city?: string } | null)?._city ??
          (opt?.sublabel?.split("·")[0]?.trim() ?? "");
        onChange(id, city);
      }}
      fetcher={fetcher}
      placeholder="Selecciona comuna"
      searchPlaceholder="Buscar comuna"
      emptyText="Sin comunas"
    />
  );
}
