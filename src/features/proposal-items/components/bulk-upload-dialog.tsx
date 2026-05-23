"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { bulkCreateItemsAction } from "../actions";
import type { BranchFieldDef } from "../queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BranchOption = { id: string; name: string };

export function BulkUploadDialog({
  proposalId,
  open,
  onOpenChange,
  branches,
  fieldSchemasByBranch,
}: {
  proposalId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branches: BranchOption[];
  fieldSchemasByBranch: Record<string, BranchFieldDef[]>;
}) {
  const router = useRouter();
  const [branchTypeId, setBranchTypeId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = branchTypeId
    ? (fieldSchemasByBranch[branchTypeId] ?? [])
    : [];

  function downloadTemplate() {
    if (!branchTypeId || fields.length === 0) {
      toast.error("Selecciona un ramo primero");
      return;
    }
    const headers = fields.map((f) => f.fieldKey);
    const labels = fields.map((f) => f.label);
    // Hoja con dos filas: una con keys (que es lo que el back parsea) y otra con labels (para legibilidad).
    const ws = XLSX.utils.aoa_to_sheet([headers, labels]);
    const wb = XLSX.utils.book_new();
    const branchName =
      branches.find((b) => b.id === branchTypeId)?.name ?? "Ramo";
    XLSX.utils.book_append_sheet(wb, ws, branchName.slice(0, 30));
    XLSX.writeFile(wb, `plantilla-${branchTypeId}.xlsx`);
  }

  async function handleFile(file: File) {
    setError(null);
    setSubmitting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        setError("El archivo no contiene hojas válidas.");
        setSubmitting(false);
        return;
      }
      // Tomamos la primera fila como header. Si la segunda fila parece labels (texto, sin números), la saltamos.
      const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      // Si la primera fila parece "labels", la sacamos.
      const filtered = rowsRaw.filter((row) => {
        const allEmpty = Object.values(row).every(
          (v) => v === undefined || v === null || v === "",
        );
        return !allEmpty;
      });
      if (filtered.length === 0) {
        setError("El archivo está vacío.");
        setSubmitting(false);
        return;
      }
      const r = await bulkCreateItemsAction(proposalId, branchTypeId, filtered);
      setSubmitting(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(`${r.data?.count ?? 0} ítems agregados`);
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      console.error(e);
      setError("Error procesando el archivo.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="size-4" /> Carga masiva
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carga masiva de ítems</DialogTitle>
          <DialogDescription>
            Descarga la plantilla del ramo, complétala y súbela. Las columnas
            deben coincidir con las claves de los campos del ramo (primera fila).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ramo</Label>
            <Select value={branchTypeId} onValueChange={setBranchTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona ramo" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {branchTypeId && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <div className="mb-2 font-medium">
                Campos esperados ({fields.length}):
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {fields.map((f) => (
                  <div key={f.id} className="flex justify-between gap-2">
                    <span className="font-mono text-muted-foreground">
                      {f.fieldKey}
                    </span>
                    <span className="text-right text-muted-foreground">
                      {f.required ? "(*)" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              disabled={!branchTypeId}
            >
              <FileSpreadsheet className="size-4" />
              Descargar plantilla
            </Button>
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted ${
                !branchTypeId ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <Upload className="size-4" />
              {submitting ? "Procesando…" : "Subir xlsx"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>
          {error && (
            <div className="whitespace-pre-line rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
