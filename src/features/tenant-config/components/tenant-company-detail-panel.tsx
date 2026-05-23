"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import {
  updateTenantCompanyOperativeAction,
  upsertCompanyContactAction,
  deleteCompanyContactAction,
} from "../actions";
import {
  tenantCompanyOperativeSchema,
  type TenantCompanyOperativeValues,
  companyContactSchema,
  type CompanyContactValues,
} from "../schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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

type CompanySummary = {
  id: string;
  isCustom: boolean;
  name: string;
  legalName: string | null;
  rut: string | null;
  address: string | null;
  commune: string | null;
  city: string | null;
  url: string | null;
  isLife: boolean;
  brokerCode: string | null;
  paymentLink: string | null;
  bankAccountClp: string | null;
  bankAccountUsd: string | null;
  defaultEmail: string | null;
  status: string;
};

type ContactRow = {
  id: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  celular: string | null;
  role: string | null;
  isDefault: boolean;
};

const EMPTY_CONTACT: CompanyContactValues = {
  name: "",
  lastName: "",
  email: "",
  phone: "",
  celular: "",
  role: "",
  isDefault: false,
};

export function TenantCompanyDetailPanel({
  company,
  contacts,
}: {
  company: CompanySummary;
  contacts: ContactRow[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ContactsCard companyId={company.id} contacts={contacts} />
      </div>
      <div className="space-y-4">
        <CompanyDataCard company={company} />
        <OperativeCard company={company} />
      </div>
    </div>
  );
}

function CompanyDataCard({ company }: { company: CompanySummary }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Datos {company.isCustom ? "(custom)" : "(del catálogo global)"}
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Row label="Razón social">{company.legalName ?? "—"}</Row>
        <Row label="RUT">{company.rut ?? "—"}</Row>
        <Row label="Dirección">{company.address ?? "—"}</Row>
        <Row label="Comuna/Ciudad">
          {[company.commune, company.city].filter(Boolean).join(", ") || "—"}
        </Row>
        <Row label="Sitio web">
          {company.url ? (
            <a href={company.url} className="text-primary hover:underline" target="_blank">
              {company.url}
            </a>
          ) : (
            "—"
          )}
        </Row>
      </dl>
      {!company.isCustom && (
        <div className="mt-3 text-xs text-muted-foreground">
          Estos datos los administra el SaaS-admin. Si necesitas un cambio,
          contáctanos.
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

function OperativeCard({ company }: { company: CompanySummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<TenantCompanyOperativeValues>({
    brokerCode: company.brokerCode ?? "",
    paymentLink: company.paymentLink ?? "",
    bankAccountClp: company.bankAccountClp ?? "",
    bankAccountUsd: company.bankAccountUsd ?? "",
    defaultEmail: company.defaultEmail ?? "",
    status: (company.status as "ACTIVA" | "INACTIVA") ?? "ACTIVA",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = tenantCompanyOperativeSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await updateTenantCompanyOperativeAction(company.id, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success("Datos operativos actualizados");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Datos operativos (tu corredora)
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Editar">
              <Pencil className="size-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Datos operativos</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Código de corredor</Label>
                <Input
                  value={values.brokerCode}
                  onChange={(e) =>
                    setValues({ ...values, brokerCode: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email default para envío de propuesta</Label>
                <Input
                  type="email"
                  value={values.defaultEmail}
                  onChange={(e) =>
                    setValues({ ...values, defaultEmail: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Link cobranza</Label>
                <Input
                  value={values.paymentLink}
                  onChange={(e) =>
                    setValues({ ...values, paymentLink: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Cuenta CLP (datos transferencia)</Label>
                <Input
                  value={values.bankAccountClp}
                  onChange={(e) =>
                    setValues({ ...values, bankAccountClp: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Cuenta USD (datos transferencia)</Label>
                <Input
                  value={values.bankAccountUsd}
                  onChange={(e) =>
                    setValues({ ...values, bankAccountUsd: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={values.status}
                  onValueChange={(v) =>
                    setValues({ ...values, status: v as "ACTIVA" | "INACTIVA" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVA">Activa</SelectItem>
                    <SelectItem value="INACTIVA">Inactiva</SelectItem>
                  </SelectContent>
                </Select>
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
                  onClick={() => setOpen(false)}
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
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Row label="Código corredor">
          {company.brokerCode ? (
            <span className="font-mono text-xs">{company.brokerCode}</span>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Email envío">{company.defaultEmail ?? "—"}</Row>
        <Row label="Link cobranza">
          {company.paymentLink ? (
            <a
              href={company.paymentLink}
              className="text-primary hover:underline"
              target="_blank"
            >
              link
            </a>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Cuenta CLP">{company.bankAccountClp ?? "—"}</Row>
        <Row label="Cuenta USD">{company.bankAccountUsd ?? "—"}</Row>
      </dl>
    </div>
  );
}

function ContactsCard({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: ContactRow[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-base font-semibold">Contactos en la compañía</h2>
        <ContactDialog
          companyId={companyId}
          contactId={null}
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Agregar contacto
            </Button>
          }
          initial={EMPTY_CONTACT}
        />
      </div>
      {contacts.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Aún no hay contactos para esta compañía.
        </div>
      ) : (
        <ul className="divide-y">
          {contacts.map((c) => (
            <ContactItem key={c.id} contact={c} companyId={companyId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactItem({
  companyId,
  contact,
}: {
  companyId: string;
  contact: ContactRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function handleDelete() {
    if (!confirm(`¿Eliminar el contacto ${contact.name}?`)) return;
    const r = await deleteCompanyContactAction(contact.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Contacto eliminado");
    router.refresh();
  }
  return (
    <li className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-medium">
            {contact.name} {contact.lastName ?? ""}
          </div>
          {contact.isDefault && (
            <Badge variant="success" className="gap-1">
              <Star className="size-3" /> Default
            </Badge>
          )}
        </div>
        {contact.role && (
          <div className="text-xs text-muted-foreground">{contact.role}</div>
        )}
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {contact.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" />
              {contact.email}
            </span>
          )}
          {(contact.celular || contact.phone) && (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" />
              {contact.celular ?? contact.phone}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <ContactDialog
          companyId={companyId}
          contactId={contact.id}
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Editar">
              <Pencil className="size-3.5" />
            </Button>
          }
          initial={{
            name: contact.name,
            lastName: contact.lastName ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            celular: contact.celular ?? "",
            role: contact.role ?? "",
            isDefault: contact.isDefault,
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
    </li>
  );
}

function ContactDialog({
  companyId,
  contactId,
  open,
  onOpenChange,
  trigger,
  initial,
}: {
  companyId: string;
  contactId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  initial: CompanyContactValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = companyContactSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    const r = await upsertCompanyContactAction(companyId, contactId, parsed.data);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success(contactId ? "Contacto actualizado" : "Contacto agregado");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contactId ? "Editar" : "Nuevo"} contacto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nombre *</Label>
            <Input
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Apellido</Label>
            <Input
              value={values.lastName}
              onChange={(e) =>
                setValues({ ...values, lastName: e.target.value })
              }
            />
          </div>
          <div className="col-span-2">
            <Label>Cargo</Label>
            <Input
              value={values.role}
              onChange={(e) => setValues({ ...values, role: e.target.value })}
              placeholder="ej: Ejecutivo emisión"
            />
          </div>
          <div className="col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input
              value={values.phone}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Celular</Label>
            <Input
              value={values.celular}
              onChange={(e) =>
                setValues({ ...values, celular: e.target.value })
              }
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.isDefault}
              onCheckedChange={(v) =>
                setValues({ ...values, isDefault: v === true })
              }
            />
            Contacto por defecto para envío de propuestas
          </label>
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
