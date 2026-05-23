import { cn } from "@/lib/utils";

/** Marca de Polizza: escudo (protección) con verificación. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role="img"
      aria-label="Polizza"
    >
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M16 6.5l7.2 3v6.1c0 5.1-3.1 8.4-7.2 9.4-4.1-1-7.2-4.3-7.2-9.4V9.5l7.2-3z"
        fill="var(--primary-foreground)"
        opacity="0.96"
      />
      <path
        d="M12.4 16.2l2.7 2.7 5.1-5.3"
        stroke="var(--primary)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 font-semibold text-foreground",
        className,
      )}
    >
      <Logo className="size-7" />
      <span className="text-lg tracking-tight">Polizza</span>
    </span>
  );
}
