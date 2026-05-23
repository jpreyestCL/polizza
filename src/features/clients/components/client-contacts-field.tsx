"use client";

import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import {
  CONTACT_ASSIGNMENTS,
  CONTACT_ASSIGNMENT_LABELS,
  type ClientFormValues,
} from "../schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_CONTACT = {
  name: "",
  role: "",
  email: "",
  phone: "",
  celular: "",
  assignmentType: "" as const,
  isPrimary: false,
};

export function ClientContactsField({
  clientType,
}: {
  clientType: "PERSONA" | "EMPRESA";
}) {
  const { control, register, formState } = useFormContext<ClientFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "contacts",
  });
  const roleLabel = clientType === "EMPRESA" ? "Cargo" : "Relación familiar";

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          {clientType === "EMPRESA"
            ? "Agrega la persona encargada y otros contactos de la empresa."
            : "Sin contactos. Por defecto el contacto es el cliente; agrega otros si aplica."}
        </p>
      )}

      {fields.map((field, index) => {
        const errors = formState.errors.contacts?.[index];
        return (
          <div
            key={field.id}
            className="space-y-3 rounded-lg border bg-muted/20 p-3"
          >
            <div className="flex items-start gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`contact-name-${index}`}>
                    Nombre completo
                  </Label>
                  <Input
                    id={`contact-name-${index}`}
                    aria-invalid={!!errors?.name}
                    {...register(`contacts.${index}.name`)}
                  />
                  {errors?.name && (
                    <p className="text-xs font-medium text-destructive">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`contact-role-${index}`}>{roleLabel}</Label>
                  <Input
                    id={`contact-role-${index}`}
                    placeholder={
                      clientType === "EMPRESA"
                        ? "Ej. Gerente de finanzas"
                        : "Ej. Cónyuge, hijo/a"
                    }
                    {...register(`contacts.${index}.role`)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`contact-email-${index}`}>Correo</Label>
                  <Input
                    id={`contact-email-${index}`}
                    type="email"
                    aria-invalid={!!errors?.email}
                    {...register(`contacts.${index}.email`)}
                  />
                  {errors?.email && (
                    <p className="text-xs font-medium text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`contact-phone-${index}`}>Teléfono</Label>
                  <Input
                    id={`contact-phone-${index}`}
                    {...register(`contacts.${index}.phone`)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`contact-celular-${index}`}>Celular</Label>
                  <Input
                    id={`contact-celular-${index}`}
                    {...register(`contacts.${index}.celular`)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Asignación</Label>
                  <Controller
                    control={control}
                    name={`contacts.${index}.assignmentType`}
                    render={({ field: f }) => (
                      <Select
                        value={f.value || undefined}
                        onValueChange={f.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sin asignación" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTACT_ASSIGNMENTS.map((value) => (
                            <SelectItem key={value} value={value}>
                              {CONTACT_ASSIGNMENT_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label="Eliminar contacto"
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
            <Controller
              control={control}
              name={`contacts.${index}.isPrimary`}
              render={({ field: cb }) => (
                <label className="flex w-fit items-center gap-2 text-sm">
                  <Checkbox
                    checked={cb.value}
                    onCheckedChange={(checked) =>
                      cb.onChange(checked === true)
                    }
                  />
                  Contacto principal
                </label>
              )}
            />
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ ...EMPTY_CONTACT })}
      >
        <Plus />
        Agregar contacto
      </Button>
    </div>
  );
}
