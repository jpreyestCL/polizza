# Cambios frente a la especificación

Cada fila dice cómo se comportaba el software y qué quedó aplicado. La
especificación manda cuando el comportamiento anterior no coincidía.

## Emisión con problemas

**Antes.** Registrar un error de emisión pasaba la propuesta a `DEVUELTA` y no
creaba la póliza de cartera. El botón decía “Devolver a la compañía”.

**Ahora.** La propuesta queda `POR_DESPACHAR`, igual que una emisión correcta.
El motivo y el detalle se guardan en la propuesta y, al despachar, en
`Policy.issueProblemCode`, `issueProblemDetail` e `issueProblemOpenedAt`. La
póliza entra a la cartera con un aviso. Nace la tarea "Solicitar endoso de
corrección", con plazo de 10 días hábiles, primero sobre la propuesta y luego
sobre la póliza. `DEVUELTA` sigue existiendo para una devolución de la
compañía antes de emitir.

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

Al cerrar el plan, pagada y presunta cuentan como cobradas. La castigada se
resta del saldo (no queda como deuda). Pendiente y rechazada se anulan. En
una parcial se guarda el monto cobrado: esa parte cuenta como pagada y el
resto de la cuota se anula. Al borrar el endoso de término, cada cuota vuelve
al estado que tenía (parcial o rechazada), no siempre a pendiente.

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

## Envío inmutable

**Antes.** Pasar la propuesta a enviada guardaba `sentAt` y una línea de
bitácora. No quedaba una foto del expediente, y un cambio posterior no se
podía distinguir de lo que se mandó.

**Ahora.** Cada envío (cambio de estado, marca sin correo o correo real)
crea un `PolicySubmission` con número de secuencia y un JSON de la
propuesta y sus ítems. Ese registro no se actualiza. La propuesta sigue
siendo el expediente editable y la póliza de cartera se crea al despachar.

## Comparación de emisión

**Antes.** No había comparación entre lo pedido y lo emitido. La persona
marcaba el problema a mano y la póliza igual se creaba.

**Ahora.** Al despachar se guarda un `AiComparison` con sus
`AiDiscrepancy`. Si el número, la prima o la marca de problema no coinciden,
el veredicto es con problemas. `blocksIssuance` queda en falso: la póliza se
crea igual. No hay llamada a un modelo de lenguaje: la comparación usa los
campos que ya están en la propuesta y en la póliza.

## Deducible

**Antes.** El deducible de la cobertura de la póliza era un texto.

**Ahora.** Al guardar la cobertura se lee el texto. "UF 3" llena el monto,
"10 % mín. UF 5" llena porcentaje y mínimo, y un texto libre se conserva
sin inventar cifras. Esas columnas viajan al despacho y a la renovación.

## Comisiones N:M

**Antes.** La revisión comparaba un pago contra la comisión esperada de la
póliza, dentro de la tolerancia.

**Ahora.** Existen la liquidación (`CommissionStatement`), sus líneas y el
calce (`CommissionAllocation`). El calce parte una línea entre varios
esperados y junta varias líneas en un esperado, de la misma póliza y
moneda. El residuo dentro de la tolerancia no queda como diferencia. No hay
aún un cargador de archivo de la compañía: el calce está listo para esas
líneas.

## Presunción PAC/PAT

**Antes.** Presunta pagada solo se marcaba a mano. No había un parámetro de
la corredora.

**Ahora.** `OrganizationSettings.presumedPaidEnabled` nace en falso. En
cobranza, "Revisar cuotas PAC y PAT" no cambia ninguna cuota mientras el
parámetro está apagado. Si se enciende, una cuota pendiente de un plan PAC
o PAT, vencida hace más de 10 días, pasa a presunta.

## Roles

**Antes.** Ejecutivo, gerente y administrador. El ejecutivo veía solo su
cartera. No existía la matriz de permisos.

**Ahora.** `permissions.yaml` publica los seis roles de fábrica
(administrador, ejecutivo de cuentas, cobranza, siniestros, finanzas y solo
lectura) con alcance de toda la corredora. El ejecutivo histórico ve la
corredora completa, igual que el resto. El gerente que ya existe conserva
los permisos de administrador para no dejar la corredora piloto sin gestión.
Borrar clientes, propuestas, pólizas y siniestros sigue en gerente y
administrador.

## Informes R-01 a R-12

**Antes.** Informes mostraba producción, cartera, retención, mora y
siniestros, sin el catálogo de las doce preguntas.

**Ahora.** La página lista R-01 a R-12 con la pregunta y la cifra que sale
de los datos actuales. R-05 cuenta cuotas marcadas pagadas, porque no hay
un pago aparte de la cuota. R-11 no calcula tasa de éxito: la cotización de
auto no tiene ganado ni perdido. R-12 usa la prima devengada a hoy y no
mezcla monedas.

## Siniestros

**Antes.** El siniestro se movía a mano entre reportado, ingresado en
compañía, en evaluación, aprobado, rechazado, pagado y cerrado. Anular
ponía una marca y se podía reabrir igual que un cerrado. No había
subestado, resultado de cierre ni plazo legal del informe.

**Ahora.** El estado es el de la especificación: aviso recibido, denunciado
a la espera de asignación, en liquidación, proceso de pago, cerrado y
anulado. Solo se avanza por esos pasos. Anular vale únicamente en el aviso
o en la espera de asignación, y no se reabre. Reabrir un cerrado vuelve a
liquidación o a proceso de pago, con motivo y contador. El cierre guarda
uno de los doce resultados: sin pago desde la liquidación, o pagado o
reparado desde el proceso de pago. El subestado cambia dentro de la
liquidación y del pago. Al enviar el denuncio nace el plazo legal del
informe: 45 días corridos, 90 si la prima anual de la póliza en UF supera
100, y 180 en casco. Una prórroga reemplaza esa fecha. El proceso de pago
exige indemnización mayor a cero. La asignación pide si es preventivo y
deja la tarea de pedir el informe cinco días antes del plazo. Si se anota
la fecha del informe final, el plazo para impugnar queda a diez días
hábiles. El cierre interno queda a 60 días corridos desde el aviso. Los
siniestros que ya existían se tradujeron: pagado quedó cerrado con
resultado pagado, rechazado quedó cerrado con resultado rechazado, y uno
marcado anulado pasó a `VOID`.

## Endosos y renovaciones

**Antes.** El endoso guardaba el método de cálculo y la prima se digitaba. La pérdida total cancelaba la póliza y un segundo endoso de término reemplazaba el saldo. Renovar creaba al tiro una póliza vigente y marcaba el origen como renovado. La recotización no existía como marca distinta de la sucesora. SOAP entraba a la cola igual que el resto.

**Ahora.** Si el monto viene vacío, la prórroga, la cancelación, la anulación y la pérdida total calculan la prima: devolución sobre los días del movimiento, prórroga con base 365, anulación del 100 % y pérdida total en cero. El monto digitado manda cuando viene de la compañía. La pérdida total cancela la madre solo si era el único ítem y no cierra el plan. Un segundo endoso de término no reemplaza el saldo que ya existe. La prórroga mueve el fin de vigencia. La autorización del acreedor se busca en los documentos de la póliza. La renovación abre una propuesta en elaboración, copia ítems vigentes y prima anterior como referencia, y el origen sigue vigente hasta que esa sucesora se emite. Recotizar deja la póliza pendiente con la marca «cotizando». Una sucesora cancelada después de su inicio cuenta como renovada; si se rechaza, se descarta, se anula o se cancela desde el inicio, el origen vuelve a la cola. La cola avisa el riesgo y crea el seguimiento a 45, 30 y 15 días. SOAP no entra. La renovación masiva puede nacer en elaboración o ya emitida.

## Migración Brokeris

**Antes.** El mapa traía el estado de la propuesta, la moneda, el siniestro, el despacho y el cliente, y solo diez tipos de endoso. No distinguía quién inicia el endoso, ni la periodicidad 596–599, ni el tipo de despacho, ni los 23 motivos de no renovación, ni los 40 cierres, ni la etiqueta original del documento. No armaba `lineageId` ni el período de la cadena. No evaluaba Q1–Q13. La pantalla de importación solo creaba clientes.

**Ahora.** Los 35 tipos de endoso de Brokeris quedan en los 18 códigos, con quién los inicia. El 0 es la emisión, no un tipo. El 40 queda en rebaja de vigencia y el 37 en anulación de prórroga. El 23 y el 24 quedan en ajuste de prima, y el 28 en declaración. Un tipo apagado en el MVP conserva su código y entra con método manual. La periodicidad mensual, trimestral, semestral y anual se traduce aparte del medio de pago: el contado sigue siendo `SINGLE`. La no renovación, el tipo de despacho, el subestado, el resultado de cierre y la etiqueta del documento usan las tablas de la sección 7. Una etiqueta que no está en el punto de partida queda en `OTHER` para revisar, y se conserva el texto original. Las compañías con el mismo RUT se fusionan quedándose con la ficha que tiene más pólizas. La cadena de renovación asigna la raíz y el período en orden de vigencia. El cuadre compara los conteos del 29-09-2026: exacto en pólizas, partes, renovaciones y siniestros abiertos; ±0,01 UF en prima y comisión; ±0,1 % en pagos de comisión; ±0,5 % en la producción 2025. Q2 queda informativo y fuera del Gate A. En Importaciones se pega el texto tabulado y se ve la traducción; el lote se registra y no crea pólizas. El respaldo X1–X17 no está en el repositorio, así que esa carga completa no corre todavía. La moneda UF que ya guarda el producto sigue como UF; el código 1 de Brokeris se traduce a CLF.

## Aislamiento en la base

**Antes.** Solo el cliente Prisma filtraba por `organizationId`.

**Ahora.** La migración habilita RLS en las tablas con `organizationId`,
sin FORCE. Si la sesión no trae corredora, la política deja pasar, así la
app sigue leyendo con el rol actual. Dentro de una transacción de envío o
despacho se fija la corredora solo para esa transacción, no en la conexión
del pool.

## Cotización, rechazo, despacho y pago

**Antes.** La única cotización era la de auto, con un simulador. No había rechazo de la compañía ni reapertura de una enviada. El despacho era un botón sin cola. Marcar una cuota pagada no dejaba un pago con fechas. La liquidación de la compañía no se cargaba. Fusionar clientes y renovar el mes en lote no existían.

**Ahora.** Una solicitud de cotización recorre borrador, solicitada, cotizada, enviada al cliente, ganada o perdida. Ganada crea una propuesta en elaboración. Rechazar una enviada exige motivo y la deja `RECHAZADA`. Reabrirla vuelve a elaboración y conserva la foto del envío. Al recepcionar nace un despacho pendiente; al despachar queda enviado. Una cuota pagada o parcial deja un `InstallmentPayment` con fecha de pago, fecha en que se marcó y fuente manual. La liquidación se carga por número de póliza y monto y se calza. Fusionar pasa la cartera de un RUT duplicado a la ficha que se conserva. Renovar el mes, en lote, queda reservado a administración y pide motivo. El catálogo de plantillas de correo está en configuración.

## Ciclo, endosos, importación y extracción

**Antes.** No había comando para descartar una propuesta ni para reabrir una emisión ya despachada. El endoso no miraba la cláusula de inalterabilidad. No había lote de importación, ni lectura de texto, ni CSV por informe. Anular o reabrir un siniestro no existía. La cuota acreditada no existía. El login no consultaba el segundo factor. El gerente no veía el menú de configuración.

**Ahora.** Descartar deja la propuesta en `DESCARTADA` con motivo, solo antes de que exista póliza. Reabrir la emisión exige `policies.reopen` y motivo, y se niega con `REOPEN_BLOCKED` si hay endosos, pagos, cuotas presuntas, comisiones asignadas o despacho enviado. Si pasa, revierte el asiento de emisión, anula las cuotas pendientes, cancela el despacho pendiente y devuelve la propuesta a enviada. El siguiente despacho reutiliza la misma póliza. Un endoso sobre una póliza con cláusula de inalterabilidad no se crea sin autorización del acreedor o sin el permiso de excepción y un motivo. Si se registra una cancelación por no pago que la compañía ya emitió, se crea igual y queda la tarea de avisar al acreedor. El tipo de la especificación y el método de cálculo se guardan en el endoso. La importación de clientes se previsualiza, se aplica y se puede revertir si la ficha no tiene cartera. La extracción lee el texto en el servidor y deja la fila para aceptar o rechazar. Cada informe R-01 a R-12 descarga un CSV. El siniestro se anula y se reabre con motivo, y la ficha muestra el plazo de liquidación de la plantilla. La cuota pagada o parcial puede guardar la fecha en que la compañía la registró. `CREDITED` existe y no se marca a mano ni cuenta como mora. El segundo factor se pide solo si `mfaRequired` está encendido; si no, la contraseña entra igual. Google y Microsoft se registran solo cuando hay credenciales en el entorno. El gerente ve la configuración porque conserva los permisos de administrador.

## Lo que queda apagado a propósito

| Tema | Cómo queda | Por qué no se enciende solo |
|---|---|---|
| Llamada a un modelo para leer el PDF | La extracción es local, por el texto pegado, y la comparación sigue usando los campos digitados | Encender un proveedor externo sin contrato mandaría datos de clientes afuera |
| SSO Google/Microsoft y MFA obligatorio | `mfaRequired` y `ssoEnabled` nacen en falso. El login consulta el segundo factor y, apagado, deja pasar la contraseña. Google y Microsoft se registran si hay credenciales. El botón de Google aparece con `NEXT_PUBLIC_SSO_GOOGLE=1` | No hay proveedor de identidad en el entorno de la corredora piloto. Encender el segundo factor sin inscripción deja a esa persona en la pantalla del código |
| RLS forzado | La política existe y no está forzada | Forzarla con el rol dueño de las tablas, sin la variable de sesión en cada conexión, deja la aplicación sin leer |
