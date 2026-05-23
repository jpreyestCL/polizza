"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { holdingFormSchema, type HoldingFormValues } from "../schemas";
import { createHoldingAction, updateHoldingAction } from "../actions";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type HoldingDraft = {
  id: string;
  name: string;
  notes: string | null;
};

export function HoldingDialog({
  open,
  onOpenChange,
  holding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: HoldingDraft | null;
}) {
  const router = useRouter();
  const form = useForm<HoldingFormValues>({
    resolver: zodResolver(holdingFormSchema),
    defaultValues: { name: holding?.name ?? "", notes: holding?.notes ?? "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: holding?.name ?? "", notes: holding?.notes ?? "" });
    }
  }, [open, holding, form]);

  async function onSubmit(values: HoldingFormValues) {
    const result = holding
      ? await updateHoldingAction(holding.id, values)
      : await createHoldingAction(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(holding ? "Holding actualizado" : "Holding creado");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {holding ? "Editar holding" : "Nuevo holding"}
          </DialogTitle>
          <DialogDescription>
            Un holding agrupa varios clientes relacionados.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="holding-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del holding</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Grupo Aconcagua" {...field} />
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
                    <Textarea rows={3} {...field} />
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
            onClick={() => onOpenChange(false)}
            disabled={form.formState.isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="holding-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="animate-spin" />
            )}
            {holding ? "Guardar" : "Crear holding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
