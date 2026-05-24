"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  searchPoliciesForClaimAction,
  getPolicyItemsForClaimAction,
  createClaimAction,
} from "../actions";
import type { PolicySearchResult } from "../queries";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type Step = "policy" | "item" | "confirm";

type PolicyItem = {
  id: string;
  description: string;
  insuredAmount: number | null;
  currency: string;
  proposalItem: {
    id: string;
    identification: string | null;
    branchTypeId: string | null;
    branchType: { id: string; key: string; name: string } | null;
    insuredClientId: string | null;
    beneficiaryClientId: string | null;
  } | null;
};

type PolicyWithItems = {
  id: string;
  policyNumber: string;
  clientId: string;
  proposalId: string | null;
  items: PolicyItem[];
};

export function NewClaimWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("policy");

  // Paso 1: búsqueda de pólizas
  const [query, setQuery] = useState("");
  const [includeNonActive, setIncludeNonActive] = useState(false);
  const [searching, startSearching] = useTransition();
  const [results, setResults] = useState<PolicySearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [policy, setPolicy] = useState<PolicySearchResult | null>(null);

  // Paso 2: ítems de la póliza seleccionada
  const [loadingItems, startLoadingItems] = useTransition();
  const [policyDetail, setPolicyDetail] = useState<PolicyWithItems | null>(
    null,
  );
  const [item, setItem] = useState<PolicyItem | null>(null);

  // Paso 3: descripción
  const [description, setDescription] = useState("");
  const [submitting, startSubmitting] = useTransition();

  function search() {
    startSearching(async () => {
      const rows = await searchPoliciesForClaimAction(query, includeNonActive);
      setResults(rows);
      setHasSearched(true);
    });
  }

  function selectPolicy(p: PolicySearchResult) {
    setPolicy(p);
    setItem(null);
    setPolicyDetail(null);
    startLoadingItems(async () => {
      const detail = await getPolicyItemsForClaimAction(p.id);
      setPolicyDetail(detail);
      setStep("item");
    });
  }

  function selectItem(it: PolicyItem) {
    setItem(it);
    setStep("confirm");
  }

  function submit() {
    if (!policy || !item) return;
    startSubmitting(async () => {
      const result = await createClaimAction({
        clientId: policy.client.id,
        policyId: policy.id,
        policyItemId: item.id,
        proposalItemId: item.proposalItem?.id ?? "",
        branchTypeId: item.proposalItem?.branchTypeId ?? "",
        description: description.trim() || `Siniestro sobre ${item.description}`,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Denuncio creado");
      router.push(`/siniestros/${result.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <Stepper step={step} />

      {step === "policy" && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Buscar póliza</h2>
            <p className="text-sm text-muted-foreground">
              Ingresa el número de póliza, RUT o nombre del cliente.
            </p>
          </div>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <div className="relative sm:flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="N° póliza, RUT o cliente"
                className="pl-8"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
              Buscar
            </Button>
          </form>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={includeNonActive}
              onCheckedChange={(v) => setIncludeNonActive(Boolean(v))}
            />
            Incluir pólizas no vigentes (canceladas, anuladas, vencidas)
          </label>

          {hasSearched && (
            <div className="rounded-lg border">
              {results.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No se encontraron pólizas con ese criterio.
                </p>
              ) : (
                <ul className="divide-y">
                  {results.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.policyNumber}</span>
                          <Badge
                            variant={
                              p.status === "VIGENTE" ? "success" : "muted"
                            }
                          >
                            {p.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {p.client.name} · {p.client.rut}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vigencia: {formatDate(p.startDate)} —{" "}
                          {formatDate(p.endDate)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => selectPolicy(p)}>
                        Seleccionar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {step === "item" && policy && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Seleccionar ítem</h2>
              <p className="text-sm text-muted-foreground">
                Póliza {policy.policyNumber} — {policy.client.name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("policy");
                setPolicy(null);
                setPolicyDetail(null);
              }}
            >
              Cambiar póliza
            </Button>
          </div>

          {loadingItems ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando ítems…
            </div>
          ) : !policyDetail || policyDetail.items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Esta póliza no tiene ítems registrados. No se puede denunciar un
              siniestro sin un ítem asociado.
            </p>
          ) : (
            <ul className="space-y-2">
              {policyDetail.items.map((it) => (
                <li
                  key={it.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{it.description}</p>
                    {it.proposalItem?.branchType && (
                      <p className="text-xs text-muted-foreground">
                        Ramo: {it.proposalItem.branchType.name}
                      </p>
                    )}
                    {it.insuredAmount !== null && (
                      <p className="text-xs text-muted-foreground">
                        Monto asegurado: {it.insuredAmount.toLocaleString()}{" "}
                        {it.currency}
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => selectItem(it)}>
                    Denunciar este ítem
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === "confirm" && policy && item && (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-base font-semibold">Crear denuncio</h2>
            <p className="text-sm text-muted-foreground">
              Se generará un número de carpeta correlativo y podrás completar el
              resto de los datos en la ficha.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Póliza:</span>{" "}
              <strong>{policy.policyNumber}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Cliente:</span>{" "}
              {policy.client.name} ({policy.client.rut})
            </p>
            <p>
              <span className="text-muted-foreground">Ítem:</span>{" "}
              {item.description}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción inicial</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumen del siniestro (puedes ampliarlo después)"
              rows={3}
            />
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("item")}>
              Volver
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Crear denuncio
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "policy", label: "Buscar póliza" },
    { id: "item", label: "Seleccionar ítem" },
    { id: "confirm", label: "Crear denuncio" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full border text-xs ${
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : active
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={
                active
                  ? "font-medium"
                  : done
                    ? "text-foreground"
                    : "text-muted-foreground"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground">›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
