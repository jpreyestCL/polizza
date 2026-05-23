"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Key, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import {
  upsertCredentialAction,
  deleteCredentialAction,
} from "../actions";
import { credentialFormSchema, type CredentialFormValues } from "../schemas";
import type { CredentialItem } from "../queries";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type InsurerOption = { key: string; name: string };

export function CredentialsPanel({
  credentials,
  insurers,
}: {
  credentials: CredentialItem[];
  insurers: InsurerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: { insurerKey: "", username: "", password: "", notes: "" },
  });

  function openNew() {
    setEditing(null);
    form.reset({ insurerKey: "", username: "", password: "", notes: "" });
    setOpen(true);
  }

  function openEdit(c: CredentialItem) {
    setEditing(c);
    form.reset({
      insurerKey: c.insurerKey,
      username: c.username,
      password: "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  async function onSubmit(values: CredentialFormValues) {
    const result = await upsertCredentialAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Credencial guardada");
    setOpen(false);
    form.reset();
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteCredentialAction(id);
    setDeletingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Credencial eliminada");
    router.refresh();
  }

  const configuredKeys = new Set(credentials.map((c) => c.insurerKey));
  const insurersForForm = editing
    ? insurers
    : insurers.filter((i) => !configuredKeys.has(i.key));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={openNew}
          disabled={insurersForForm.length === 0 && !editing}
        >
          <Plus />
          Agregar credencial
        </Button>
      </div>

      {credentials.length === 0 ? (
        <EmptyState
          icon={Key}
          title="Sin credenciales configuradas"
          description="Para que los scrapers reales puedan iniciar sesión en los portales, registra usuario y contraseña por aseguradora. (Los adaptadores simulados actuales no las requieren.)"
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {credentials.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 p-3.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{c.insurerName}</p>
                  <Badge
                    variant={c.status === "ACTIVA" ? "success" : "muted"}
                  >
                    {c.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usuario {c.username} · actualizado{" "}
                  {formatDateTime(c.updatedAt)}
                </p>
                {c.notes && (
                  <p className="text-xs text-muted-foreground">{c.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(c)}
                  aria-label="Editar"
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  aria-label="Eliminar"
                >
                  {deletingId === c.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 className="text-muted-foreground" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `Editar credencial · ${editing.insurerName}`
                : "Nueva credencial"}
            </DialogTitle>
            <DialogDescription>
              La contraseña se cifra con AES-256-GCM antes de almacenarse.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="credential-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="insurerKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aseguradora</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={Boolean(editing)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {insurersForForm.map((i) => (
                          <SelectItem key={i.key} value={i.key}>
                            {i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Contraseña{editing ? " (déjala para sobrescribir)" : ""}
                    </FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="credential-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="animate-spin" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
