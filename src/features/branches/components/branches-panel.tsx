"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { branchFormSchema, type BranchFormValues } from "../schemas";
import {
  createBranchAction,
  deleteBranchAction,
  updateBranchAction,
} from "../actions";
import type { BranchItem } from "../queries";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function emptyDefaults(): BranchFormValues {
  return {
    name: "",
    address: "",
    contactName: "",
    region: "",
    commune: "",
    phone: "",
    celular: "",
    email: "",
  };
}

function valuesFrom(branch: BranchItem): BranchFormValues {
  return {
    name: branch.name,
    address: branch.address ?? "",
    contactName: branch.contactName ?? "",
    region: branch.region ?? "",
    commune: branch.commune ?? "",
    phone: branch.phone ?? "",
    celular: branch.celular ?? "",
    email: branch.email ?? "",
  };
}

function BranchDialog({
  open,
  onOpenChange,
  clientId,
  branch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  branch: BranchItem | null;
}) {
  const router = useRouter();
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: branch ? valuesFrom(branch) : emptyDefaults(),
  });

  useEffect(() => {
    if (open) {
      form.reset(branch ? valuesFrom(branch) : emptyDefaults());
    }
  }, [open, branch, form]);

  async function onSubmit(values: BranchFormValues) {
    const result = branch
      ? await updateBranchAction(branch.id, values)
      : await createBranchAction(clientId, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(branch ? "Sucursal actualizada" : "Sucursal agregada");
    onOpenChange(false);
    router.refresh();
  }

  const fields: { name: keyof BranchFormValues; label: string }[] = [
    { name: "address", label: "Dirección" },
    { name: "contactName", label: "Nombre de contacto" },
    { name: "region", label: "Región" },
    { name: "commune", label: "Comuna" },
    { name: "phone", label: "Teléfono" },
    { name: "celular", label: "Celular" },
    { name: "email", label: "Correo" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {branch ? "Editar sucursal" : "Nueva sucursal"}
          </DialogTitle>
          <DialogDescription>
            Datos de la sucursal de la empresa.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="branch-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la sucursal</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Sucursal Centro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{f.label}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={form.formState.isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="branch-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="animate-spin" />
            )}
            {branch ? "Guardar" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BranchesPanel({
  clientId,
  branches,
}: {
  clientId: string;
  branches: BranchItem[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function remove(id: string) {
    setDeletingId(id);
    const result = await deleteBranchAction(id);
    setDeletingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Sucursal eliminada");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          Agregar sucursal
        </Button>
      </div>

      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin sucursales"
          description="Agrega las sucursales de la empresa para asociarlas a sus propuestas y pólizas."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {branches.map((branch) => (
            <li
              key={branch.id}
              className="rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{branch.name}</p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Editar sucursal"
                    onClick={() => {
                      setEditing(branch);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar sucursal"
                    disabled={deletingId === branch.id}
                    onClick={() => remove(branch.id)}
                  >
                    {deletingId === branch.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <dl className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                {branch.contactName && <dd>{branch.contactName}</dd>}
                {branch.address && <dd>{branch.address}</dd>}
                {(branch.commune || branch.region) && (
                  <dd>
                    {[branch.commune, branch.region]
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                )}
                {(branch.phone || branch.celular) && (
                  <dd>
                    {[branch.phone, branch.celular]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                )}
                {branch.email && <dd>{branch.email}</dd>}
              </dl>
            </li>
          ))}
        </ul>
      )}

      <BranchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        branch={editing}
      />
    </div>
  );
}
