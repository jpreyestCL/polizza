/**
 * Fija la corredora solo dentro de la transacción actual.
 * El tercer argumento de set_config en true no deja la variable en la
 * conexión del pool, así que no se filtra a la siguiente petición.
 */
export async function setTenantGuc(
  tx: {
    $executeRaw: (
      query: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<unknown>;
  },
  organizationId: string,
): Promise<void> {
  if (!organizationId) return;
  await tx.$executeRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
}
