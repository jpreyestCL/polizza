# Spec — Pólizas

Fecha: 2026-05-22
Estado: aprobado para implementación
Sub-proyecto 3 de 6 del MVP 1.

## Alcance

Gestión de la cartera de pólizas: registro, ficha completa, cambios de estado,
renovaciones y conversión desde propuestas emitidas. Las tablas `Policy`,
`PolicyItem`, `PolicyCoverage`, `PolicyStatusHistory` ya están modeladas.

Fuera de alcance: cobranza y cuotas (sub-proyecto posterior).

## Estados

`PolicyStatus`: VIGENTE, VENCIDA, RENOVADA, CANCELADA. Cada cambio escribe
`PolicyStatusHistory` y `ActivityLog`. El número de póliza lo ingresa el usuario
(viene de la compañía) y es único por organización.

## Renovaciones (días calendario)

`lib/renewal.ts` deriva el estado de renovación de una póliza VIGENTE según los
días hasta `endDate`: ≤60 → próxima; ≤30 → urgente; vencida si la fecha pasó.
`/renovaciones` lista las pólizas que requieren gestión, ordenadas por urgencia.

Renovar una póliza crea una nueva copiando sus datos (vigencia adelantada un
año), enlaza ambas con `previousPolicyId`/`nextPolicyId` y deja la anterior
como RENOVADA.

## Conversión propuesta → póliza

Una propuesta EMITIDA / POR_DESPACHAR / DESPACHADA muestra "Convertir a póliza",
que abre `/polizas/nuevo` con el formulario prellenado (cliente, compañía, ramo,
prima, vigencia) y `proposalId` enlazado.

## Pantallas

- `/polizas` — tabla TanStack con filtros, export CSV e indicador de vencimiento.
- `/polizas/nuevo` y `/polizas/[id]/editar` — formulario con materia asegurada
  (`PolicyItem`) y coberturas (`PolicyCoverage`) como arreglos dinámicos.
- `/polizas/[id]` — ficha con tabs: Resumen, Materia, Coberturas, Historial,
  Documentos, Actividad. Acciones: cambiar estado, renovar, editar, eliminar.
- `/renovaciones` — pólizas próximas a vencer o vencidas, con acción de renovar.

## Criterios de aceptación

- Crear, editar, listar pólizas; número único por organización.
- Materia asegurada y coberturas editables.
- Renovación crea póliza enlazada y marca la anterior RENOVADA.
- Conversión desde propuesta prellena y enlaza el origen.
- Las fechas `@db.Date` se muestran sin desfase horario.
- `pnpm build`, `pnpm lint`, `pnpm test` pasan.
