"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCw } from "lucide-react";
import { reprocessResultAction } from "../actions";
import { Button } from "@/components/ui/button";

export function ReprocessButton({ resultId }: { resultId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function handle() {
    setBusy(true);
    const result = await reprocessResultAction(resultId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Reintentando…");
    router.refresh();
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={handle} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <RotateCw />}
      Reintentar
    </Button>
  );
}
