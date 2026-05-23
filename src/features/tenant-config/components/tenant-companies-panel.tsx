"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Building2,
  Globe,
  Heart,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  adoptGlobalCompanyAction,
  createCustomCompanyAction,
  updateCustomCompanyAction,
  deleteTenantCompanyAction,
} from "../actions";
import type {
  AvailableGlobalCompany,
  TenantCompanyRow,
} from "../queries";
import {
  tenantCustomCompanySchema,
  type TenantCustomCompanyValues,
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

const EMPTY_CUSTOM: TenantCustomCompanyValues = {
  name: "",
  legalName: "",
  rut: "",
  address: "",
  commune: "",
  city: "",
  url: "",
  logoUrl: "",
  isLife: false,
  brokerCode: "",
  paymentLink: "",
  bankAccountClp: "",
  bankAccountUsd: "",
  defaultEmail: "",
};

export function TenantCompaniesPanel({
  rows,
  available,
}: {
  rows: TenantCompanyRow[];
  available: AvailableGlobalCompany[];
}) {
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <AdoptDialog
          open={adoptOpen}
          onOpenChange={setAdoptOpen}
          available={available}
        />
        <CustomCompanyDialog
          open={customOpen}
          onOpenChange={setCustomOpen}
          trigger={
            <Button variant="outline">
              <Plus className="size-4" /> Compañía custom
            </Button>
          }
          initial={EMPTY_CUSTOM}
          onSubmit={async (values) => {
            const r = await createCustomCompanyAction(values);
            if (!r.ok) return r.error;
            toast.success("Compañía custom creada");
            return null;
          }}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Compañía</th>
              <th className="px-3 py-2 text-left">Origen</th>
              <th className="px-3 py-2 text-left">Código corredor</th>
              <th className="px-3 py-2 text-left">Email envío</th>
              <th className="px-3 py-2 text-center">Contactos</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Aún no tienes compañías. Adopta del catálogo global o crea una
                  custom.
                </td>
              </tr>
            ) : (
              rows.map((r) => <CompanyRow key={r.id} row={r} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyRow({ row }: { row: TenantCompanyRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function handleDelete() {
    if (!confirm(`¿Eliminar/desactivar "${row.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteTenantCompanyAction(row.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Compañía eliminada o desactivada");
      router.refresh();
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <div>
            <div className="font-medium">
              <Link
                href={`/configuracion/companias/${row.id}`}
                className="hover:underline"
              >
                {row.name}
              </Link>
            </div>
            {row.legalName && (
              <div className="text-xs text-muted-foreground">{row.legalName}</div>
            )}
          </div>
          {row.isLife && (
            <Badge variant="secondary" className="gap-1">
              <Heart className="size-3" /> Vida
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        {row.isCustom ? (
          <Badge variant="outline">Custom</Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Globe className="size-3" /> Global
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {row.brokerCode ?? "—"}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {row.defaultEmail ?? "—"}
      </td>
      <td className="px-3 py-2 text-center">{row.contactsCount}</td>
      <td className="px-3 py-2 text-center">
        {row.status === "ACTIVA" ? (
          <Badge variant="success">Activa</Badge>
        ) : (
          <Badge variant="muted">Inactiva</Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <Link href={`/configuracion/companias/${row.id}`}>
            <Button variant="ghost" size="icon" aria-label="Detalle">
              <UserPlus className="size-4" />
            </Button>
          </Link>
          {row.isCustom && (
            <CustomCompanyDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Editar">
                  <Pencil className="size-4" />
                </Button>
              }
              initial={{
                name: row.name,
                legalName: row.legalName ?? "",
                rut: row.rut ?? "",
                address: row.address ?? "",
                commune: row.commune ?? "",
                city: row.city ?? "",
                url: row.url ?? "",
                logoUrl: row.logoUrl ?? "",
                isLife: row.isLife,
                brokerCode: row.brokerCode ?? "",
                paymentLink: row.paymentLink ?? "",
                bankAccountClp: row.bankAccountClp ?? "",
                bankAccountUsd: row.bankAccountUsd ?? "",
                defaultEmail: row.defaultEmail ?? "",
              }}
              onSubmit={async (values) => {
                const r = await updateCustomCompanyAction(row.id, values);
                if (!r.ok) return r.error;
                toast.success("Compañía actualizada");
                return null;
              }}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar"
            onClick={handleDelete}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AdoptDialog({
  open,
  onOpenChange,
  available,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  available: AvailableGlobalCompany[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAdopt(globalId: string, name: string) {
    setLoading(globalId);
    const r = await adoptGlobalCompanyAction(globalId);
    setLoading(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`${name} agregada a tu maestro`);
    onOpenChange(false);
    startTransition(() => router.refresh());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Globe className="size-4" /> Adoptar del catálogo global
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Catálogo de compañías globales</DialogTitle>
          <DialogDescription>
            Estas compañías están preconfiguradas. Al adoptarlas se agregan a tu
            maestro y puedes ingresar tu código corredor, link de cobranza y
            contactos.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1 overflow-auto pr-1">
          {available.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Ya tienes todas las compañías del catálogo en tu maestro.
            </div>
          ) : (
            available.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.isLife && (
                      <Badge variant="secondary" className="gap-1">
                        <Heart className="size-3" /> Vida
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.legalName ?? c.rut ?? ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading === c.id}
                  onClick={() => handleAdopt(c.id, c.name)}
                >
                  {loading === c.id ? "Agregando…" : "Adoptar"}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomCompanyDialog({
  open,
  onOpenChange,
  trigger,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: TenantCustomCompanyValues;
  onSubmit: (values: TenantCustomCompanyValues) => Promise<string | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = tenantCustomCompanySchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const err = await onSubmit(parsed.data);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compañía custom</DialogTitle>
          <DialogDescription>
            Una compañía que no está en el catálogo global. Solo será visible
            para tu corredora.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <FormSection title="Datos de la compañía" colSpan={2}>
            <Field label="Nombre comercial *" required>
              <Input
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Razón social">
              <Input
                value={values.legalName}
                onChange={(e) =>
                  setValues({ ...values, legalName: e.target.value })
                }
              />
            </Field>
            <Field label="RUT">
              <Input
                value={values.rut}
                onChange={(e) => setValues({ ...values, rut: e.target.value })}
              />
            </Field>
            <Field label="URL">
              <Input
                value={values.url}
                onChange={(e) => setValues({ ...values, url: e.target.value })}
              />
            </Field>
            <Field label="Dirección comercial" colSpan={2}>
              <Input
                value={values.address}
                onChange={(e) =>
                  setValues({ ...values, address: e.target.value })
                }
              />
            </Field>
            <Field label="Comuna">
              <Input
                value={values.commune}
                onChange={(e) =>
                  setValues({ ...values, commune: e.target.value })
                }
              />
            </Field>
            <Field label="Ciudad">
              <Input
                value={values.city}
                onChange={(e) =>
                  setValues({ ...values, city: e.target.value })
                }
              />
            </Field>
            <Field label="URL del logo" colSpan={2}>
              <Input
                value={values.logoUrl}
                onChange={(e) =>
                  setValues({ ...values, logoUrl: e.target.value })
                }
              />
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isLife}
                onCheckedChange={(v) =>
                  setValues({ ...values, isLife: v === true })
                }
              />
              Compañía de Vida
            </label>
          </FormSection>

          <FormSection title="Datos operativos del corredor" colSpan={2}>
            <Field label="Código de corredor">
              <Input
                value={values.brokerCode}
                onChange={(e) =>
                  setValues({ ...values, brokerCode: e.target.value })
                }
              />
            </Field>
            <Field label="Email default para envío">
              <Input
                type="email"
                value={values.defaultEmail}
                onChange={(e) =>
                  setValues({ ...values, defaultEmail: e.target.value })
                }
              />
            </Field>
            <Field label="Link cobranza" colSpan={2}>
              <Input
                value={values.paymentLink}
                onChange={(e) =>
                  setValues({ ...values, paymentLink: e.target.value })
                }
                placeholder="https://..."
              />
            </Field>
            <Field label="Cuenta CLP (transferencia)" colSpan={2}>
              <Input
                value={values.bankAccountClp}
                onChange={(e) =>
                  setValues({ ...values, bankAccountClp: e.target.value })
                }
              />
            </Field>
            <Field label="Cuenta USD (transferencia)" colSpan={2}>
              <Input
                value={values.bankAccountUsd}
                onChange={(e) =>
                  setValues({ ...values, bankAccountUsd: e.target.value })
                }
              />
            </Field>
          </FormSection>

          {error && (
            <div className="col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter className="col-span-2">
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

function FormSection({
  title,
  colSpan = 1,
  children,
}: {
  title: string;
  colSpan?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  colSpan = 1,
  children,
}: {
  label: string;
  required?: boolean;
  colSpan?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
