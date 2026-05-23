"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateProposalSettingsAction } from "../proposal-settings";
import { SUPPORTED_TIMEZONES } from "../proposal-settings-constants";
import { formatProposalNumber } from "@/features/proposals/number-generator-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  initial: {
    reservaDays: number;
    proposalNumberPattern: string;
    proposalSequenceYear: number | null;
    proposalSequenceValue: number;
    timezone: string;
  };
};

export function ProposalSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reservaDays, setReservaDays] = useState(String(initial.reservaDays));
  const [pattern, setPattern] = useState(initial.proposalNumberPattern);
  const [timezone, setTimezone] = useState(
    initial.timezone || "America/Santiago",
  );

  const currentYear = new Date().getFullYear();
  const previewSeq =
    initial.proposalSequenceYear === currentYear
      ? initial.proposalSequenceValue + 1
      : 1;
  const preview = formatProposalNumber(pattern, currentYear, previewSeq);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProposalSettingsAction({
        reservaDays: Number(reservaDays),
        proposalNumberPattern: pattern,
        timezone,
      });
      if (res.ok) {
        toast.success("Configuración guardada");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border p-5 max-w-2xl">
      <div className="space-y-1">
        <Label htmlFor="reservaDays">Días de reserva por defecto</Label>
        <Input
          id="reservaDays"
          type="number"
          min={1}
          max={365}
          value={reservaDays}
          onChange={(e) => setReservaDays(e.target.value)}
          className="max-w-[120px]"
        />
        <p className="text-xs text-muted-foreground">
          Cantidad de días informada en la carta de reserva enviada a la compañía.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="pattern">Patrón de numeración de propuestas</Label>
        <Input
          id="pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="{YEAR}-{SEQ:0000}"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Tokens disponibles: <code>{"{YEAR}"}</code>, <code>{"{SEQ:0000}"}</code> (relleno con ceros según el número de N o 0).
        </p>
        <p className="text-xs">
          Próximo número: <span className="font-mono font-medium">{preview}</span>
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="timezone">Zona horaria de la corredora</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger id="timezone" className="max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Se usa para formatear fechas, horas y bitácoras en toda la aplicación.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
