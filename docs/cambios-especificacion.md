# Cambios frente a la especificación

Cada fila dice cómo se comportaba el software y qué quedó aplicado. La
especificación manda cuando el comportamiento anterior no coincidía.

## Emisión con problemas

**Antes.** Registrar un error de emisión pasaba la propuesta a `DEVUELTA` y no
creaba la póliza de cartera. El botón decía “Devolver a la compañía”.

**Ahora.** La propuesta queda `POR_DESPACHAR`, igual que una emisión correcta.
El motivo y el detalle se guardan en la propuesta y, al despachar, en
`Policy.issueProblemCode`, `issueProblemDetail` e `issueProblemOpenedAt`. La
póliza entra a la cartera con un aviso. La corrección es un endoso. `DEVUELTA`
sigue existiendo para una devolución de la compañía antes de emitir.

## Libro de primas

**Antes.** La prima vigente era un solo grupo de columnas en la póliza
(`premiumNet`, y a veces afecta/exenta). Un endoso de cancelación no cambiaba
esa prima: el crédito vivía solo como saldo de término estimado.

**Ahora.** Cada emisión, endoso de prima y reverso es un `PremiumMovement`.
La prima vigente de la póliza es la suma del libro (afecta, exenta, neta y
comisión). El IVA se calcula solo sobre la prima afecta, redondeo half-up a
4 decimales. La comisión esperada de cada movimiento es un
`CommissionReceivable`.

Al cancelar o anular se asegura primero el asiento de emisión (para no perder
la prima original) y después se asienta el crédito negativo. Borrar ese endoso
escribe un reverso con la comisión negada del asiento original. El receivable
del movimiento original y el del reverso quedan `VOID`, para que la suma de
comisiones pendientes no cuente dos veces.

Las pólizas anteriores al libro reciben el movimiento 0 al abrir la ficha o
los informes, con la prima que ya estaba guardada y fecha de asiento igual a
la creación. La producción del mes usa la fecha de asiento, así que ese
relleno no infla el mes en curso.

Un endoso que no es cancelación ni anulación puede informar un delta de prima
afecta y exenta. Ese delta se suma al libro al registrar el endoso. El corte
por pérdida total no cierra el plan de pago; si cambia la prima, el delta se
informa a mano.

## Cuotas

**Antes.** Solo había pendiente, pagada y anulada. “Vencida” se calculaba
sobre pendiente. Al cancelar se anulaban solo las pendientes y el saldo
restaba únicamente lo pagado.

**Ahora.** Los estados son pendiente, parcial, presunta pagada, pagada,
rechazada, castigada y anulada. Vencida no es un estado: es pendiente, parcial
o rechazada con fecha pasada. Presunta, pagada, castigada y anulada no entran
en la mora.

Presunta pagada no se asigna sola. Queda solo si alguien la marca en la
cuota. Anulada sigue reservada al cierre por cancelación o anulación.

Al cerrar el plan, pagada y presunta cuentan como cobradas. Se anulan las
pendientes y las rechazadas. La parcial no se anula: no hay un monto cobrado
aparte del estado, y anularla perdería ese registro.

En cobranza, “por vencer” incluye pendiente, parcial y rechazada que aún no
vencen. “Pagadas” incluye pagada y presunta.

## Renovación y saldo de término

**Antes.** La cola de renovaciones miraba sobre todo pólizas vigentes por
vencer. No había estado de no renovación ni producto no renovable. Cancelar
no dejaba un saldo único de término ni anulaba las cuotas impagas de forma
explícita como efecto del endoso.

**Ahora.** El estado de renovación tiene nueve valores y la retención del mes
sale de esa misma clasificación. Se puede marcar la póliza como no renovable
o registrar una no renovación reversible. El producto tiene `isRenewable`.
Cancelar o anular (no el corte por pérdida total) anula las cuotas impagas,
guarda el saldo de término estimado y, al borrar el último endoso de ese
tipo, reabre el plan.

## Consentimientos

**Antes.** La ficha del cliente no registraba consentimiento de marketing ni
de tratamiento con IA.

**Ahora.** Ambos son opt-in, apagados por defecto, con la fecha en que se
marcaron. Desmarcarlos borra la fecha.

## Informes

**Antes.** No había una vista de informes. La cartera y la mora se miraban en
pólizas y cobranza.

**Ahora.** Informes muestra producción del mes (libro), cartera vigente por
moneda (stock = suma vigente), retención del mes, mora por antigüedad y
siniestros por estado. La mora se exporta en CSV.

## Lo que sigue distinto de la especificación

Estas piezas no quedaron reescritas en este cambio. El comportamiento actual
se anota para no presentarlo como si ya cumpliera la spec.

| Tema | Cómo funciona hoy | Por qué no se reescribió aquí |
|---|---|---|
| Una sola entidad Póliza y envíos aparte | Sigue habiendo Propuesta (elaboración, envío, recepción, despacho) y Póliza de cartera | Reemplazar Propuesta rompe el flujo que ya usa la corredora piloto. El despacho crea la póliza y el libro; la propuesta queda como el expediente de emisión |
| Extracción de PDF con IA y comparación que no bloquea | No hay extracción ni comparación automática. La marca de problemas la carga la persona en la recepción | Hace falta el contrato del modelo y los documentos de la compañía. La marca de emisión con problemas ya no bloquea el alta |
| Conciliación de archivos de la compañía y match N:M de comisiones | La revisión de comisiones compara el pago registrado contra la comisión esperada, con tolerancia del máximo entre 0,5 % y 0,01 de la moneda | El match de muchas líneas de un archivo contra muchos receivables no tiene cargador de archivo en este cambio |
| Motor PAC/PAT de presunción | Apagado. Presunta pagada es un estado manual | La especificación lo deja inactivo por defecto |
| Seis roles de fábrica, SSO y MFA | Roles ejecutivo, gerente y admin, con email y contraseña | La matriz `permissions.yaml` y el proveedor de identidad no están en el repositorio |
| RLS de Postgres | El aislamiento es el cliente Prisma que inyecta `organizationId`, ahora también en el libro y en la comisión esperada | Las políticas RLS dependen del rol de base con el que corre la app; aplicarlas sin ese rol deja la app sin leer |
| Migración Brokeris | No hay importador del dump | Hace falta el mapeo de tablas del origen |
| Doce informes sobre el libro | Hay producción, cartera, retención, mora y siniestros | El resto de definiciones (corte, columnas y filtros) no está en el código y no se inventaron cifras |
| Deducible estructurado | El deducible de la cobertura es texto | Pasarlo a campos (monto, porcentaje, mínimo) cambia la ficha y el PDF sin el catálogo de formas de la spec |
| SLA de siniestros | El siniestro tiene estados y bitácora, sin plantilla de plazos | Las plantillas por ramo no están cargadas |
