"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca la página mientras la cotización está EN_PROCESO. Cada `intervalMs`
 * dispara `router.refresh()` para que server components vuelvan a leer la BD.
 */
export function PollQuotation({
  status,
  intervalMs = 3000,
}: {
  status: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (status !== "EN_PROCESO") return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [status, intervalMs, router]);
  return null;
}
