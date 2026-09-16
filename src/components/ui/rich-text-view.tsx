import { sanitizeRichText } from "@/lib/sanitize";
import { isHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Muestra en pantalla el contenido de un campo de texto enriquecido.
 *
 * Se sanitiza SIEMPRE antes de pintar, aunque las actions ya sanitizan al
 * guardar: el contenido puede venir de una importación, de una fila escrita
 * antes de que existiera la limpieza, o de un flujo nuevo que se olvide de
 * llamarla. Sanitizar de este lado también convierte el olvido en un bug
 * visual en vez de un XSS.
 *
 * Si el valor es texto plano (lo habitual en los registros ya cargados) se
 * respetan sus saltos de línea con `whitespace-pre-line`.
 */
export function RichTextView({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;

  if (!isHtml(value)) {
    return (
      <div className={cn("whitespace-pre-line text-sm", className)}>{value}</div>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-sm",
        "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
    />
  );
}
