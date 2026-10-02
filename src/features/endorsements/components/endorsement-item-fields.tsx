"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ITEM_AMOUNT_TYPES,
  ITEM_DESCRIPTION_TYPES,
  ITEM_TARGET_TYPES,
  type EndorsementTypeValue,
} from "../schemas";

export type EndorsementPolicyItem = {
  id: string;
  description: string;
  insuredAmount: number | null;
};

type ItemValues = {
  type: EndorsementTypeValue;
  targetItemId: string;
  itemDescription: string;
  newInsuredAmount: string;
};

export function EndorsementItemFields<T extends ItemValues>({
  values,
  onChange,
  items,
}: {
  values: T;
  onChange: (next: T) => void;
  items: EndorsementPolicyItem[];
}) {
  const needsTarget = ITEM_TARGET_TYPES.includes(values.type);
  const needsDescription = ITEM_DESCRIPTION_TYPES.includes(values.type);
  const needsAmount = ITEM_AMOUNT_TYPES.includes(values.type);
  if (!needsTarget && !needsDescription && !needsAmount) return null;

  return (
    <div className="space-y-3 rounded-md border p-3">
      {needsTarget ? (
        <div>
          <Label className="text-xs">Ítem de la póliza *</Label>
          <Select
            value={values.targetItemId || "none"}
            onValueChange={(v) =>
              onChange({ ...values, targetItemId: v === "none" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Elige el ítem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Elige el ítem</SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.description}
                  {item.insuredAmount != null
                    ? ` · ${item.insuredAmount.toLocaleString("es-CL")}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {items.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              La póliza no tiene ítems vigentes.
            </p>
          ) : null}
        </div>
      ) : null}
      {needsDescription ? (
        <div>
          <Label className="text-xs">
            {values.type === "AGREGA_ITEMS"
              ? "Glosa del ítem nuevo *"
              : values.type === "REEMPLAZA_ITEMS"
                ? "Glosa del ítem que reemplaza *"
                : "Glosa corregida *"}
          </Label>
          <Input
            value={values.itemDescription}
            onChange={(e) =>
              onChange({ ...values, itemDescription: e.target.value })
            }
            placeholder="Ej: Patente ABCD12, Toyota Yaris 2024"
          />
        </div>
      ) : null}
      {needsAmount ? (
        <div>
          <Label className="text-xs">
            {values.type === "MODIFICA_MONTO_PRIMA"
              ? "Nuevo monto asegurado del ítem *"
              : "Monto asegurado del ítem"}
          </Label>
          <Input
            inputMode="decimal"
            value={values.newInsuredAmount}
            onChange={(e) =>
              onChange({ ...values, newInsuredAmount: e.target.value })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
