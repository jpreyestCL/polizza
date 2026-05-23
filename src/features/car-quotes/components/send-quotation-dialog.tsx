"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { sendQuotationEmailAction } from "../actions";
import {
  EMAIL_TEMPLATES,
  sendQuotationEmailSchema,
  type SendQuotationEmailValues,
} from "../schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export type ContactOption = {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
};

export type AttachableResult = {
  id: string;
  insurerName: string;
  premiumLabel: string;
};

export function SendQuotationDialog({
  quotationId,
  contacts,
  attachableResults,
  defaultSubject,
}: {
  quotationId: string;
  contacts: ContactOption[];
  attachableResults: AttachableResult[];
  defaultSubject: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultContact = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const form = useForm<SendQuotationEmailValues>({
    resolver: zodResolver(sendQuotationEmailSchema),
    defaultValues: {
      template: "estandar",
      to: defaultContact?.email ?? "",
      cc: "",
      subject: defaultSubject,
      body: EMAIL_TEMPLATES[0].body,
      attachComparativePdf: true,
      attachComparativeCsv: false,
      attachResultIds: attachableResults.map((r) => r.id),
    },
  });

  function applyTemplate(key: "estandar" | "ejecutivo") {
    const tpl = EMAIL_TEMPLATES.find((t) => t.key === key)!;
    form.setValue("subject", tpl.subject);
    form.setValue("body", tpl.body);
  }

  async function onSubmit(values: SendQuotationEmailValues) {
    const result = await sendQuotationEmailAction(quotationId, values);
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof SendQuotationEmailValues, { message });
        }
      }
      toast.error(result.error);
      return;
    }
    toast.success("Correo enviado");
    setOpen(false);
    router.refresh();
  }

  const attachIds = form.watch("attachResultIds");

  function toggleResult(id: string) {
    const current = form.getValues("attachResultIds") ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    form.setValue("attachResultIds", next);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Mail />
        Enviar por correo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar cotización por correo</DialogTitle>
            <DialogDescription>
              El envío y los adjuntos quedan registrados en la actividad de la
              cotización y del cliente.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="quotation-email-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plantilla</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        applyTemplate(v as "estandar" | "ejecutivo");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EMAIL_TEMPLATES.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            {t.label}
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
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinatario</FormLabel>
                    {contacts.length > 0 && (
                      <Select
                        value={contacts.find((c) => c.email === field.value)?.id}
                        onValueChange={(id) => {
                          const c = contacts.find((x) => x.id === id);
                          if (c) field.onChange(c.email);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un contacto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} · {c.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormControl>
                      <Input
                        inputMode="email"
                        placeholder="correo@ejemplo.cl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cc</FormLabel>
                    <FormControl>
                      <Input placeholder="opcional, separa por coma" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asunto</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensaje</FormLabel>
                    <FormControl>
                      <Textarea rows={6} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Adjuntos</Label>
                <div className="space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.watch("attachComparativePdf")}
                      onCheckedChange={(v) =>
                        form.setValue("attachComparativePdf", Boolean(v))
                      }
                    />
                    Tabla comparativa (PDF)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.watch("attachComparativeCsv")}
                      onCheckedChange={(v) =>
                        form.setValue("attachComparativeCsv", Boolean(v))
                      }
                    />
                    Tabla comparativa (Excel · CSV)
                  </label>
                  {attachableResults.length > 0 && (
                    <div className="mt-2 space-y-1.5 rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Cotizaciones individuales
                      </p>
                      {attachableResults.map((r) => (
                        <label
                          key={r.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={attachIds.includes(r.id)}
                            onCheckedChange={() => toggleResult(r.id)}
                          />
                          {r.insurerName} · {r.premiumLabel}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
              form="quotation-email-form"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="animate-spin" />
              )}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
