"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  upsertBranchFieldAction,
  deleteBranchFieldAction,
  moveBranchFieldAction,
  normalizeBranchFieldOrdersAction,
} from "../actions";
import {
  branchFieldSchemaSchema,
  type BranchFieldSchemaValues,
} from "../schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FieldRow = {
  id: string;
  fieldKey: string;
  label: string;
  type: string;
  required: boolean;
  order: number;
  options: { value: string; label: string }[] | null;
  helpText: string | null;
};

const EMPTY: BranchFieldSchemaValues = {
  fieldKey: "",
  label: "",
  type: "text",
  required: false,
  order: "0",
  options: "",
  helpText: "",
};

const TYPE_LABEL: Record<string, string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  select: "Lista (select)",
  textarea: "Texto largo",
};

export function BranchFieldsPanel({
  branchTypeId,
  fields,
}: {
  branchTypeId: string;
  fields: FieldRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [normalizing, setNormalizing] = useState(false);

  async function handleNormalize() {
    if (
      !confirm(
        "Esto renumerará los campos en saltos de 10 preservando el orden actual. ¿Continuar?",
      )
    )
      return;
    setNormalizing(true);
    const r = await normalizeBranchFieldOrdersAction(branchTypeId);
    setNormalizing(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Órdenes normalizados");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Campos de la ficha</h2>
          <p className="text-xs text-muted-foreground">
            Definen qué se le pide al corredor al crear un ítem de propuesta de
            este ramo. Usa las flechas para reordenar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNormalize}
            disabled={normalizing || fields.length < 2}
            title="Renumera los órdenes en saltos de 10"
          >
            <Sparkles className="size-4" />
            {normalizing ? "Normalizando…" : "Normalizar orden"}
          </Button>
          <FieldDialog
            branchTypeId={branchTypeId}
            fieldId={null}
            open={open}
            onOpenChange={setOpen}
            trigger={
              <Button>
                <Plus className="size-4" /> Nuevo campo
              </Button>
            }
            initial={EMPTY}
          />
        </div>
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Orden</th>
              <th className="px-3 py-2 text-left">Clave</th>
              <th className="px-3 py-2 text-left">Etiqueta</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-center">Requerido</th>
              <th className="px-3 py-2 text-center">Opciones</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Aún no hay campos definidos para este ramo.
                </td>
              </tr>
            ) : (
              fields.map((f, idx) => (
                <FieldItem
                  key={f.id}
                  branchTypeId={branchTypeId}
                  field={f}
                  isFirst={idx === 0}
                  isLast={idx === fields.length - 1}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FieldItem({
  branchTypeId,
  field,
  isFirst,
  isLast,
}: {
  branchTypeId: string;
  field: FieldRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState<"up" | "down" | null>(null);

  async function handleMove(direction: "up" | "down") {
    setMoving(direction);
    const r = await moveBranchFieldAction(field.id, direction);
    setMoving(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar el campo "${field.label}"?`)) return;
    const r = await deleteBranchFieldAction(field.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Campo eliminado");
    router.refresh();
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 tabular-nums">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Subir"
            className="size-6"
            disabled={isFirst || moving !== null}
            onClick={() => handleMove("up")}
          >
            <ArrowUp className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bajar"
            className="size-6"
            disabled={isLast || moving !== null}
            onClick={() => handleMove("down")}
          >
            <ArrowDown className="size-3" />
          </Button>
          <span className="ml-1 text-xs text-muted-foreground">
            {field.order}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-xs">{field.fieldKey}</td>
      <td className="px-3 py-2">{field.label}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {TYPE_LABEL[field.type] ?? field.type}
      </td>
      <td className="px-3 py-2 text-center">
        {field.required ? (
          <Badge variant="default" className="text-[10px]">
            Sí
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {field.type === "select" && field.options?.length
          ? `${field.options.length} opciones`
          : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <FieldDialog
            branchTypeId={branchTypeId}
            fieldId={field.id}
            open={open}
            onOpenChange={setOpen}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Editar">
                <Pencil className="size-3.5" />
              </Button>
            }
            initial={{
              fieldKey: field.fieldKey,
              label: field.label,
              type: field.type as BranchFieldSchemaValues["type"],
              required: field.required,
              order: String(field.order),
              options: field.options ? JSON.stringify(field.options, null, 2) : "",
              helpText: field.helpText ?? "",
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar"
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function FieldDialog({
  branchTypeId,
  fieldId,
  open,
  onOpenChange,
  trigger,
  initial,
}: {
  branchTypeId: string;
  fieldId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: BranchFieldSchemaValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = branchFieldSchemaSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await upsertBranchFieldAction(branchTypeId, fieldId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success(fieldId ? "Campo actualizado" : "Campo creado");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setValues(initial);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{fieldId ? "Editar campo" : "Nuevo campo"}</DialogTitle>
          <DialogDescription>
            La clave es el identificador del campo en el JSON del ítem. La
            etiqueta es lo que ve el corredor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Clave * (minúsculas, _)</Label>
              <Input
                value={values.fieldKey}
                onChange={(e) =>
                  setValues({ ...values, fieldKey: e.target.value })
                }
                required
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Orden</Label>
              <Input
                type="number"
                value={values.order}
                onChange={(e) =>
                  setValues({ ...values, order: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Etiqueta *</Label>
              <Input
                value={values.label}
                onChange={(e) =>
                  setValues({ ...values, label: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select
                value={values.type}
                onValueChange={(v) =>
                  setValues({
                    ...values,
                    type: v as BranchFieldSchemaValues["type"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="date">Fecha</SelectItem>
                  <SelectItem value="textarea">Texto largo</SelectItem>
                  <SelectItem value="select">Lista (select)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.required}
                  onCheckedChange={(v) =>
                    setValues({ ...values, required: v === true })
                  }
                />
                Requerido
              </label>
            </div>
            {values.type === "select" && (
              <div className="col-span-2">
                <Label className="text-xs">
                  Opciones (JSON: array de {`{value,label}`})
                </Label>
                <Textarea
                  rows={5}
                  value={values.options}
                  onChange={(e) =>
                    setValues({ ...values, options: e.target.value })
                  }
                  placeholder={`[\n  {"value": "PARTICULAR", "label": "Particular"},\n  {"value": "COMERCIAL", "label": "Comercial"}\n]`}
                  className="font-mono text-xs"
                />
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Ayuda (opcional)</Label>
              <Input
                value={values.helpText}
                onChange={(e) =>
                  setValues({ ...values, helpText: e.target.value })
                }
              />
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
