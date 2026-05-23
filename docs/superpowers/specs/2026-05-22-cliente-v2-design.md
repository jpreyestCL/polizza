# Spec — Cliente V2

Fecha: 2026-05-22
Estado: aprobado para implementación (Fase A)
Rediseño de la ficha de Cliente. El Portal de clientes es Fase B aparte.

## Decisiones acordadas

- Prospecto → Activo: bloquear el cambio hasta completar los datos obligatorios.
- Documentos: subida real de archivos al servidor.
- Portal (Fase B): los contactos son los usuarios; en Persona el contacto
  principal es el propio cliente. Las contraseñas se piden en la Fase B.
- "Celular" reemplaza a "WhatsApp". La verificación de correo busca solo dentro
  de la corredora (multi-tenant).

## Campos obligatorios por estado

- **Prospecto**: nombre y RUT. El resto opcional.
- **Activo**: además dirección, comuna, región y al menos un teléfono o celular.
- **Empresa**: giro opcional.

## Campos nuevos en Client

`giro`, `comentarioAlerta` (si tiene texto → banner en las propuestas del
cliente), `observaciones` (reemplaza `notes`), `vendedor`, `cobranzaUserId`,
`siniestrosUserId`, `holdingId`. Rename `whatsapp` → `celular`.

## Contactos

Uno o más. Persona: el contacto por defecto son los datos de la ficha.
Empresa: se pide la persona encargada. Campos: nombre, teléfono y/o celular,
email, `role` (cargo si empresa / relación familiar si persona, texto libre),
`assignmentType` opcional (COBRANZA / SINIESTROS / EMISION).

## Sucursales (solo Empresa)

`Branch`: nombre, dirección, contacto, comuna, región, teléfono, celular, email.
Al crear una propuesta/póliza se puede asociar a una sucursal del cliente.

## Documentos del cliente

`Document` extendido con `description` y `year`. Subida real de archivos
(almacenamiento en disco del servidor, servido por nginx). Fecha automática.

## Historial de acciones

La pestaña Actividad muestra la bitácora (`ActivityLog`) e incluye registro
manual de gestiones: correo, WhatsApp, llamada, nota.

## Módulo Holding

Un holding agrupa varios clientes (`Client.holdingId`). Módulo con listado,
detalle (clientes miembros) y alta/baja de clientes.

## Esquema (Fase A — aditivo)

Nuevos: `Holding`, `Branch`, enum `ContactAssignment`. Campos aditivos en
`Client`, `ClientContact.assignmentType`, `Document` (+description, +year),
`Proposal`/`Policy` (+branchId). Los renames (`whatsapp`, `notes`) van con el
formulario V2.

## Criterios de aceptación (Fase A inicial)

- Migración aplicada local y en staging.
- Módulo Holding funcional (crear, listar, ver, agregar/quitar clientes).
- `pnpm build`, `pnpm lint`, `pnpm test` pasan.
