"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  documentFormSchema,
  DOCUMENT_TYPES,
  type DocumentEntity,
  type DocumentFormValues,
} from "../schemas";
import { addDocumentAction, deleteDocumentAction } from "../actions";
import type { DocumentItem } from "../queries";
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

export function DocumentsPanel({
  entityType,
  entityId,
  documents,
}: {
  entityType: DocumentEntity;
  entityId: string;
  documents: DocumentItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: { fileName: "", fileUrl: "", documentType: "" },
  });

  async function onSubmit(values: DocumentFormValues) {
    const result = await addDocumentAction(entityType, entityId, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Documento agregado");
    setOpen(false);
    form.reset();
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteDocumentAction(id);
    setDeletingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Documento eliminado");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            form.reset();
            setOpen(true);
          }}
        >
          <Plus />
          Agregar documento
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin documentos"
          description="Adjunta enlaces a pólizas, comprobantes y otros documentos."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between gap-3 p-3.5"
            >
              <div className="min-w-0">
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-medium hover:text-primary"
                >
                  <span className="truncate">{document.fileName}</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
                <p className="text-xs text-muted-foreground">
                  {document.documentType ? `${document.documentType} · ` : ""}
                  {formatDate(document.createdAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Eliminar documento"
                onClick={() => handleDelete(document.id)}
                disabled={deletingId === document.id}
              >
                {deletingId === document.id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Trash2 className="text-muted-foreground" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar documento</DialogTitle>
            <DialogDescription>
              Adjunta el enlace a un documento almacenado en Drive, Dropbox u
              otro servicio.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="document-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="fileName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Póliza firmada" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fileUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enlace</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="url"
                        placeholder="https://…"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              form="document-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="animate-spin" />
              )}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
