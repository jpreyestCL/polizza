"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  documentFormSchema,
  DOCUMENT_TYPES,
  type DocumentEntity,
  type DocumentFormValues,
} from "../schemas";
import {
  addDocumentAction,
  deleteDocumentAction,
  uploadDocumentAction,
} from "../actions";
import type { DocumentItem } from "../queries";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACCEPT =
  ".ppt,.pptx,.pdf,.xls,.xlsx,.txt,.doc,.docx,.jpg,.jpeg,.gif,.png,.zip,.rar,.msg,.eml";

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
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus />
          Agregar documento
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin documentos"
          description="Sube archivos (PDF, Excel, imágenes…) o adjunta enlaces a Drive/Dropbox."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {documents.map((document) => {
            const href = document.storageKey
              ? `/api/documents/${document.id}/download`
              : document.fileUrl;
            return (
              <li
                key={document.id}
                className="flex items-center justify-between gap-3 p-3.5"
              >
                <div className="min-w-0">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-medium hover:text-primary"
                  >
                    <span className="truncate">{document.fileName}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {document.documentType ? `${document.documentType} · ` : ""}
                    {document.storageKey ? "Archivo · " : "Enlace · "}
                    {formatDate(document.createdAt)}
                    {document.sizeBytes
                      ? ` · ${formatBytes(document.sizeBytes)}`
                      : ""}
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
            );
          })}
        </ul>
      )}

      <AddDocumentDialog
        entityType={entityType}
        entityId={entityId}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

function AddDocumentDialog({
  entityType,
  entityId,
  open,
  onOpenChange,
}: {
  entityType: DocumentEntity;
  entityId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("");
  const [customName, setCustomName] = useState("");
  const [uploading, setUploading] = useState(false);

  const linkForm = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: { fileName: "", fileUrl: "", documentType: "" },
  });

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona un archivo.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("documentType", docType);
    fd.set("fileName", customName);
    setUploading(true);
    const result = await uploadDocumentAction(entityType, entityId, fd);
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Documento subido");
    setDocType("");
    setCustomName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
    router.refresh();
  }

  async function onSubmitLink(values: DocumentFormValues) {
    const result = await addDocumentAction(entityType, entityId, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Documento agregado");
    onOpenChange(false);
    linkForm.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar documento</DialogTitle>
          <DialogDescription>
            Sube un archivo al sistema o adjunta un enlace externo.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1">
              Subir archivo
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1">
              Enlace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <Label className="text-xs">Archivo</Label>
                <Input ref={fileInputRef} type="file" accept={ACCEPT} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Formatos: PPT, PDF, Excel, Word, imágenes, ZIP/RAR, MSG/EML.
                  Máx 25 MB.
                </p>
              </div>
              <div>
                <Label className="text-xs">Nombre (opcional)</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Por defecto usa el nombre del archivo"
                />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={docType || undefined} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Subir
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="link">
            <Form {...linkForm}>
              <form
                onSubmit={linkForm.handleSubmit(onSubmitLink)}
                className="space-y-4"
              >
                <FormField
                  control={linkForm.control}
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
                  control={linkForm.control}
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
                  control={linkForm.control}
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
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    disabled={linkForm.formState.isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={linkForm.formState.isSubmitting}
                  >
                    {linkForm.formState.isSubmitting && (
                      <Loader2 className="animate-spin" />
                    )}
                    Agregar
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
