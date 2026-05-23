# Spec — Propuestas

Fecha: 2026-05-22
Estado: aprobado para implementación
Sub-proyecto 2 de 6 del MVP 1.

## Alcance

Gestión operativa de propuestas desde elaboración hasta despacho o rechazo.
Las tablas `Proposal`, `ProposalStatusHistory`, `ProposalReturnReason` ya están
modeladas (sub-proyecto Fundación). Este sub-proyecto agrega lógica y UI.

Fuera de alcance: conversión propuesta→póliza (llega con el sub-proyecto Pólizas).

## Estados y flujo

`ProposalStatus`: ELABORACION → ENVIADA_COMPANIA → (EMITIDA | DEVUELTA) ;
DEVUELTA → ELABORACION (corrección) ; EMITIDA → POR_DESPACHAR → DESPACHADA ;
cualquier estado → RECHAZADA. La UI permite mover entre cualquier estado; al
pasar a DEVUELTA se exige un motivo (`ProposalReturnReason`).

Cada cambio de estado: escribe `ProposalStatusHistory`, actualiza
`currentStateStartedAt`, registra `ActivityLog`.

## SLA (días hábiles)

`lib/working-days.ts` calcula días hábiles excluyendo sábados, domingos y
feriados chilenos (`Holiday`, seed global). Para una propuesta en
ENVIADA_COMPANIA: ≥5 días hábiles en estado → advertencia (badge amarillo);
≥10 → crítica (badge rojo). El nivel SLA se calcula en el servidor.

## Pantallas

- `/propuestas` — Kanban por estado (drag-and-drop nativo entre columnas) con
  toggle a vista lista (tabla TanStack con filtros y export).
- `/propuestas/nuevo` y `/propuestas/[id]/editar` — formulario (cliente,
  compañía, ramo, prima, moneda, vigencia, ejecutivo).
- `/propuestas/[id]` — detalle con tabs: Resumen, Documentos (vacío),
  Historial de estados, Actividad. Acciones: cambiar estado, editar, eliminar.

## Datos

- Número de propuesta autogenerado: `P-AAAA-NNNN` (correlativo por organización).
- Compañías y ramos desde los catálogos de la organización
  (`InsuranceCompany`, `InsuranceLine`), sembrados al crear la corredora.
- Motivos de devolución: catálogo `ProposalReturnReason` sembrado por defecto.

## Criterios de aceptación

- Crear, editar y listar propuestas; número autogenerado.
- Kanban muestra tarjetas por estado con badge de días hábiles y SLA.
- Mover de columna cambia el estado y registra historial.
- Pasar a DEVUELTA exige motivo.
- `pnpm build`, `pnpm lint`, `pnpm test` pasan.
