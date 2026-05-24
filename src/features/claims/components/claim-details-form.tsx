"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { updateClaimDetailsAction } from "../actions";
import {
  CLAIM_ENTRY_CHANNELS,
  CLAIM_ENTRY_CHANNEL_LABELS,
  CLAIM_ENTRY_PARTIES,
  CLAIM_ENTRY_PARTY_LABELS,
  CLAIM_LOSS_TYPES,
  CLAIM_LOSS_TYPE_LABELS,
  isVehicleBranch,
  type ClaimDetailsValues,
} from "../schemas";
import type { BranchFieldDef, ClaimDetail } from "../queries";
import { Button } from "@/components/ui/button";
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

function toDateInput(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
function toDateTimeInput(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function ClaimDetailsForm({
  claim,
  branchFields,
  members,
}: {
  claim: ClaimDetail;
  branchFields: BranchFieldDef[];
  members: { userId: string; name: string }[];
}) {
  const router = useRouter();
  const branchKey = claim.branchType?.key ?? null;
  const showVehiclePanel = isVehicleBranch(branchKey);

  const [values, setValues] = useState<ClaimDetailsValues>({
    entryParty: (claim.entryParty ?? "") as ClaimDetailsValues["entryParty"],
    entryChannel: (claim.entryChannel ??
      "") as ClaimDetailsValues["entryChannel"],
    reportedAtBroker: toDateTimeInput(claim.reportedAtBroker),

    reporterRut: claim.reporterRut ?? "",
    reporterFirstName: claim.reporterFirstName ?? "",
    reporterLastName: claim.reporterLastName ?? "",
    reporterPhone: claim.reporterPhone ?? "",
    reporterEmail: claim.reporterEmail ?? "",

    occurredAt: toDateInput(claim.occurredAt),
    occurredAtTime: claim.occurredAtTime ?? "",
    mainCoverageAffected: claim.mainCoverageAffected ?? "",
    policeReportDate: toDateInput(claim.policeReportDate),
    policeStation: claim.policeStation ?? "",
    policeReportFolio: claim.policeReportFolio ?? "",
    incidentCause: claim.incidentCause ?? "",
    incidentAddress: claim.incidentAddress ?? "",
    incidentCommune: claim.incidentCommune ?? "",
    incidentCity: claim.incidentCity ?? "",
    incidentNarrative: claim.incidentNarrative ?? "",

    lossType: (claim.lossType ?? "") as ClaimDetailsValues["lossType"],
    smartDeductible:
      claim.smartDeductible === null
        ? ""
        : claim.smartDeductible
          ? "true"
          : "false",
    hasAlcoholTest:
      claim.hasAlcoholTest === null
        ? ""
        : claim.hasAlcoholTest
          ? "true"
          : "false",
    driverAtFault:
      claim.driverAtFault === null
        ? ""
        : claim.driverAtFault
          ? "true"
          : "false",
    driverFirstName: claim.driverFirstName ?? "",
    driverLastName: claim.driverLastName ?? "",
    driverRut: claim.driverRut ?? "",
    driverAge: claim.driverAge !== null ? String(claim.driverAge) : "",

    estimatedAmount:
      claim.estimatedAmount !== null ? String(claim.estimatedAmount) : "",
    settledAmount:
      claim.settledAmount !== null ? String(claim.settledAmount) : "",
    currency: claim.currency as ClaimDetailsValues["currency"],
    assignedUserId: claim.assignedUserId ?? "",
    description: claim.description,
  });

  const [branchData, setBranchData] = useState<Record<string, unknown>>(
    (claim.data as Record<string, unknown>) ?? {},
  );

  const [saving, startSaving] = useTransition();

  function set<K extends keyof ClaimDetailsValues>(
    key: K,
    val: ClaimDetailsValues[K],
  ) {
    setValues((p) => ({ ...p, [key]: val }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      const result = await updateClaimDetailsAction(
        claim.id,
        values,
        branchData,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Denuncio actualizado");
      router.refresh();
    });
  }

  const insured = claim.insuredClient;
  const beneficiary = claim.beneficiaryClient;
  const contratante = claim.client;

  return (
    <form className="space-y-6" onSubmit={submit}>
      <Section title="Partes del contrato">
        <PartyCard
          label="Contratante"
          name={contratante.name}
          rut={contratante.rut}
          email={contratante.email}
          phone={contratante.phone ?? contratante.celular}
        />
        <PartyCard
          label="Asegurado"
          name={insured?.name ?? "—"}
          rut={insured?.rut}
          email={insured?.email}
          phone={insured?.phone ?? insured?.celular}
        />
        <PartyCard
          label="Beneficiario"
          name={beneficiary?.name ?? "—"}
          rut={beneficiary?.rut}
          email={beneficiary?.email}
          phone={beneficiary?.phone ?? beneficiary?.celular}
        />
      </Section>

      <Section title="Ingreso del denuncio">
        <Field label="Entrada del denuncio">
          <Select
            value={values.entryParty || "—"}
            onValueChange={(v) =>
              set(
                "entryParty",
                (v === "—" ? "" : v) as ClaimDetailsValues["entryParty"],
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="—">Sin especificar</SelectItem>
              {CLAIM_ENTRY_PARTIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {CLAIM_ENTRY_PARTY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Canal de entrada">
          <Select
            value={values.entryChannel || "—"}
            onValueChange={(v) =>
              set(
                "entryChannel",
                (v === "—" ? "" : v) as ClaimDetailsValues["entryChannel"],
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="—">Sin especificar</SelectItem>
              {CLAIM_ENTRY_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CLAIM_ENTRY_CHANNEL_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fecha y hora aviso a la corredora">
          <Input
            type="datetime-local"
            value={values.reportedAtBroker}
            onChange={(e) => set("reportedAtBroker", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Denunciante">
        <Field label="RUT">
          <Input
            value={values.reporterRut}
            onChange={(e) => set("reporterRut", e.target.value)}
          />
        </Field>
        <Field label="Nombre">
          <Input
            value={values.reporterFirstName}
            onChange={(e) => set("reporterFirstName", e.target.value)}
          />
        </Field>
        <Field label="Apellido">
          <Input
            value={values.reporterLastName}
            onChange={(e) => set("reporterLastName", e.target.value)}
          />
        </Field>
        <Field label="Celular / teléfono">
          <Input
            value={values.reporterPhone}
            onChange={(e) => set("reporterPhone", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={values.reporterEmail}
            onChange={(e) => set("reporterEmail", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Datos del siniestro">
        <Field label="Fecha del siniestro">
          <Input
            type="date"
            value={values.occurredAt}
            onChange={(e) => set("occurredAt", e.target.value)}
          />
        </Field>
        <Field label="Hora del siniestro">
          <Input
            type="time"
            value={values.occurredAtTime}
            onChange={(e) => set("occurredAtTime", e.target.value)}
          />
        </Field>
        <Field label="Cobertura principal afectada">
          <Input
            value={values.mainCoverageAffected}
            onChange={(e) => set("mainCoverageAffected", e.target.value)}
          />
        </Field>
        <Field label="Fecha del parte policial">
          <Input
            type="date"
            value={values.policeReportDate}
            onChange={(e) => set("policeReportDate", e.target.value)}
          />
        </Field>
        <Field label="Comisaría">
          <Input
            value={values.policeStation}
            onChange={(e) => set("policeStation", e.target.value)}
          />
        </Field>
        <Field label="Folio">
          <Input
            value={values.policeReportFolio}
            onChange={(e) => set("policeReportFolio", e.target.value)}
          />
        </Field>
        <Field label="Causa del siniestro">
          <Input
            value={values.incidentCause}
            onChange={(e) => set("incidentCause", e.target.value)}
          />
        </Field>
        <Field label="Dirección del siniestro" full>
          <Input
            value={values.incidentAddress}
            onChange={(e) => set("incidentAddress", e.target.value)}
          />
        </Field>
        <Field label="Comuna">
          <Input
            value={values.incidentCommune}
            onChange={(e) => set("incidentCommune", e.target.value)}
          />
        </Field>
        <Field label="Ciudad">
          <Input
            value={values.incidentCity}
            onChange={(e) => set("incidentCity", e.target.value)}
          />
        </Field>
        <Field label="Relato de los hechos" full>
          <Textarea
            rows={5}
            value={values.incidentNarrative}
            onChange={(e) => set("incidentNarrative", e.target.value)}
          />
        </Field>
      </Section>

      {showVehiclePanel && (
        <Section title="Específico vehículos / SOAP">
          <Field label="Tipo de pérdida">
            <Select
              value={values.lossType || "—"}
              onValueChange={(v) =>
                set(
                  "lossType",
                  (v === "—" ? "" : v) as ClaimDetailsValues["lossType"],
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="—">Sin especificar</SelectItem>
                {CLAIM_LOSS_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CLAIM_LOSS_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <TriBoolField
            label="Deducible inteligente"
            value={values.smartDeductible}
            onChange={(v) => set("smartDeductible", v)}
          />
          <TriBoolField
            label="¿Hay alcoholemia?"
            value={values.hasAlcoholTest}
            onChange={(v) => set("hasAlcoholTest", v)}
          />
          <TriBoolField
            label="¿Chofer es culpable?"
            value={values.driverAtFault}
            onChange={(v) => set("driverAtFault", v)}
          />
          <Field label="Nombre del chofer">
            <Input
              value={values.driverFirstName}
              onChange={(e) => set("driverFirstName", e.target.value)}
            />
          </Field>
          <Field label="Apellido del chofer">
            <Input
              value={values.driverLastName}
              onChange={(e) => set("driverLastName", e.target.value)}
            />
          </Field>
          <Field label="RUT del chofer">
            <Input
              value={values.driverRut}
              onChange={(e) => set("driverRut", e.target.value)}
            />
          </Field>
          <Field label="Edad del chofer">
            <Input
              type="number"
              min={0}
              value={values.driverAge}
              onChange={(e) => set("driverAge", e.target.value)}
            />
          </Field>
        </Section>
      )}

      {branchFields.length > 0 && (
        <Section title="Datos adicionales del ramo">
          {branchFields.map((f) => (
            <Field key={f.fieldKey} label={f.label} full={f.type === "textarea"}>
              <DynamicBranchField
                field={f}
                value={branchData[f.fieldKey]}
                onChange={(v) =>
                  setBranchData((prev) => ({ ...prev, [f.fieldKey]: v }))
                }
              />
            </Field>
          ))}
        </Section>
      )}

      <Section title="Liquidación y asignación">
        <Field label="Monto estimado">
          <Input
            inputMode="decimal"
            value={values.estimatedAmount}
            onChange={(e) => set("estimatedAmount", e.target.value)}
          />
        </Field>
        <Field label="Monto liquidado">
          <Input
            inputMode="decimal"
            value={values.settledAmount}
            onChange={(e) => set("settledAmount", e.target.value)}
          />
        </Field>
        <Field label="Moneda">
          <Select
            value={values.currency}
            onValueChange={(v) =>
              set("currency", v as ClaimDetailsValues["currency"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["UF", "CLP", "USD", "USD_OBS", "EUR", "UD"] as const).map(
                (c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ejecutivo asignado">
          <Select
            value={values.assignedUserId || "—"}
            onValueChange={(v) => set("assignedUserId", v === "—" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="—">Sin asignar</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Descripción" full>
          <Textarea
            rows={3}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TriBoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "" | "true" | "false";
  onChange: (v: "" | "true" | "false") => void;
}) {
  return (
    <Field label={label}>
      <Select
        value={value || "—"}
        onValueChange={(v) =>
          onChange((v === "—" ? "" : v) as "" | "true" | "false")
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="—">Sin especificar</SelectItem>
          <SelectItem value="true">Sí</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function PartyCard({
  label,
  name,
  rut,
  email,
  phone,
}: {
  label: string;
  name: string;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{name}</p>
      {rut && <p className="text-xs text-muted-foreground">RUT: {rut}</p>}
      {phone && <p className="text-xs text-muted-foreground">Tel: {phone}</p>}
      {email && <p className="text-xs text-muted-foreground">{email}</p>}
    </div>
  );
}

function DynamicBranchField({
  field,
  value,
  onChange,
}: {
  field: BranchFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const str = value === null || value === undefined ? "" : String(value);
  switch (field.type) {
    case "number":
      return (
        <Input
          type="number"
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
    case "richtext":
      return (
        <Textarea
          rows={3}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select
          value={str || "—"}
          onValueChange={(v) => onChange(v === "—" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="—">—</SelectItem>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return (
        <Input value={str} onChange={(e) => onChange(e.target.value)} />
      );
  }
}
