# Spec — Fundación + Clientes 360° (Polizza)

Fecha: 2026-05-22
Estado: aprobado para implementación
Sub-proyecto 1 de 6 del MVP 1.

## 1. Contexto

SaaS multi-tenant para corredoras de seguros chilenas. El producto completo abarca
14 módulos en 5 fases. Este spec cubre el primer sub-proyecto: la **Fundación**
técnica y el primer módulo funcional, **Clientes 360°**.

Nombre de trabajo del producto: **Polizza** (placeholder, renombrable).

## 2. Alcance

Dentro de alcance:

- Scaffold Next.js 15 (App Router) + TypeScript + Tailwind + pnpm.
- PostgreSQL + Prisma con el esquema **completo de MVP 1** modelado (~25 tablas);
  migración y UI solo para Auth + Clientes.
- Better Auth con plugin `organization`: multi-tenancy + RBAC.
- Aislamiento multi-tenant por capa de aplicación (extensión de Prisma Client).
- Shell de navegación autenticado + búsqueda global (esqueleto funcional sobre Clientes).
- Design system limpio y profesional (paleta OKLCH, tipografía, primitivos shadcn).
- Módulo Clientes 360°: listado, alta persona/empresa, contactos, ficha 360°.
- Catálogos Chile sembrados: regiones/comunas, aseguradoras, ramos.
- Tests (Vitest + Testing Library).
- Docker: `Dockerfile` (output standalone) + `docker-compose.yml` (Postgres local).

Fuera de alcance (sub-proyectos posteriores): Propuestas, Pólizas, Dashboard,
Tareas/Alertas/Documentos, y todos los módulos de MVP 2+.

## 3. Stack

| Capa | Elección |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Gestor de paquetes | pnpm |
| UI | Tailwind CSS, shadcn/ui, TanStack Query, TanStack Table |
| Auth | Better Auth + plugin `organization` |
| ORM / BD | Prisma + PostgreSQL |
| Validación | Zod |
| Tests | Vitest + Testing Library |
| Despliegue | Imagen Docker standalone + Postgres, en contenedor único (Railway/Render/Fly) |

## 4. Estructura del proyecto

```
src/
  app/
    (auth)/login, (auth)/registro, (auth)/aceptar-invitacion
    (app)/
      layout.tsx            # shell: navegación + búsqueda global
      page.tsx              # redirección a /clientes (dashboard llega después)
      clientes/
        page.tsx            # listado
        nuevo/page.tsx      # alta
        [id]/page.tsx       # ficha 360°
        [id]/editar/page.tsx
    api/
      auth/[...all]/route.ts   # handler Better Auth
      search/route.ts          # búsqueda global
  features/
    auth/        # config sesión, helpers de servidor, guards
    organizations/  # contexto de tenant, miembros, roles
    clients/     # components, actions, queries, schemas Zod
  server/
    db.ts        # Prisma client base + getDb(orgId) con extensión multi-tenant
    auth.ts      # instancia Better Auth
    activity.ts  # helper de bitácora (activity_log / audit_log)
  components/ui/ # primitivos shadcn
  lib/           # rut.ts, money.ts, regions-communes.ts, utils.ts
prisma/
  schema.prisma
  seed.ts
tests/
Dockerfile  docker-compose.yml  .env.example
```

Archivos < 500 líneas. Bounded contexts por carpeta de feature.

## 5. Modelo de datos (esquema MVP 1)

Tablas de Better Auth (gestionadas por el plugin): `user`, `session`, `account`,
`verification`, `organization`, `member`, `invitation`.

Tablas de dominio en `schema.prisma` (todas con `organizationId`, timestamps,
`createdById`/`updatedById` donde aplica):

- **Maestros:** `InsuranceCompany`, `InsuranceLine`, `InsuranceProduct`, `Currency`,
  `ExchangeRate`, `Holiday`.
- **Clientes:** `Client`, `ClientContact`, `ClientRelationship`, `ClientTag`,
  `ClientTagAssignment`.
- **Operación (modeladas, sin UI aún):** `Proposal`, `ProposalStatusHistory`,
  `ProposalReturnReason`, `Policy`, `PolicyItem`, `PolicyCoverage`,
  `PolicyStatusHistory`.
- **Workflow:** `Task`, `Alert`, `Comment`, `ActivityLog`, `AuditLog`.

`Client`: `id`, `organizationId`, `type` (PERSONA|EMPRESA), `rut`, `name`,
`legalName?`, `email?`, `phone?`, `whatsapp?`, `address?`, `region?`, `commune?`,
`assignedUserId?`, `source?`, `status` (ACTIVO|INACTIVO|PROSPECTO), timestamps,
`createdById`, `updatedById`. `rut` único por `organizationId`.

`ClientContact`: `id`, `organizationId`, `clientId`, `name`, `role?`, `email?`,
`phone?`, `whatsapp?`, `isPrimary`.

`ClientRelationship`: vincula dos clientes (`clientId`, `relatedClientId`,
`relationshipType`, `notes?`).

`ClientTag` (catálogo por org: `name`, `color`) + `ClientTagAssignment` (join
`clientId`/`tagId`).

Las tablas de Cotizaciones, Renovaciones, Endosos, Cobranza, Siniestros,
Comisiones y Comunicaciones se modelan con sus sub-proyectos.

## 6. Multi-tenancy

Esquema compartido, una BD. Aislamiento por **capa de aplicación**:

- `server/db.ts` exporta `getDb(organizationId)`: Prisma Client extendido cuya
  query extension inyecta `where: { organizationId }` en `findMany/findFirst/
  findUnique/update/updateMany/delete/deleteMany/count/aggregate` y fija
  `organizationId` en `create/createMany/upsert` para los modelos de dominio.
- Modelos de Better Auth y catálogos globales quedan fuera de la extensión.
- Server actions y route handlers resuelven la org activa desde la sesión de
  Better Auth (`session.activeOrganizationId`) y llaman `getDb(orgId)`.
- `$queryRaw`/`$executeRaw` prohibidos en código de `features/` (regla de ESLint);
  cualquier excepción pasa por un helper auditado en `server/`.
- Diseñado para sumar Postgres RLS como defensa en profundidad sin tocar
  código de aplicación.

## 7. RBAC y roles

Roles MVP 1 definidos como roles del plugin `organization` de Better Auth con
access-control por recurso: `admin`, `gerente`, `ejecutivo`.

- `admin`: configuración, usuarios, invitaciones, acceso total.
- `gerente`: ve toda la cartera de la org, reasigna, exporta.
- `ejecutivo`: por defecto ve su cartera (`assignedUserId = self`); crea/edita
  clientes y contactos.

Regla de alcance sobre el aislamiento de tenant: filtro adicional por
`assignedUserId` para `ejecutivo` en listados de Clientes; `gerente`/`admin` sin
ese filtro. Los otros 4 roles del documento (operacional, cobranzas, siniestros,
cliente externo) llegan en sub-proyectos posteriores.

## 8. Autenticación

- **Registro (signup abierto):** un usuario nuevo se registra con email +
  contraseña y crea su corredora (`organization`); queda como `admin` con
  `member` activo. `organization.activeOrganizationId` se fija en la sesión.
- **Login:** email + contraseña.
- **Invitaciones:** `admin` invita por email → `invitation` → el invitado abre
  el enlace, fija contraseña, queda como `member` con el rol asignado.
- **Recuperación de contraseña:** flujo de Better Auth por email.
- **Email:** transporte conectable. Dev: transporte de consola (loguea el enlace).
  Prod: Resend vía variable de entorno.
- **Sesiones:** cookie de sesión de Better Auth; middleware protege el grupo
  `(app)`; las rutas de `(auth)` son públicas.
- Eventos de auth (login, cambios de rol, alta/baja de usuario) → `AuditLog`.

## 9. Design system

Paleta OKLCH, sin `#000`/`#fff` puros, neutros tintados hacia el hue de marca.
Registro **product** (la UI sirve a la operación, no es marketing). Estrategia de
color *restrained*: neutros tintados + un acento. Tema sobrio y confiable
apropiado para uso operativo diario en una corredora. Tipografía con jerarquía
por escala y peso. Tokens en `globals.css` (variables CSS) consumidos por
Tailwind. Primitivos shadcn: Button, Input, Select, Dialog, Table, Badge, Card,
Tabs, DropdownMenu, Toast, Form, Avatar, Skeleton.

## 10. Feature: Clientes 360°

- **Listado** (`/clientes`): tabla TanStack con búsqueda, filtros (tipo, estado,
  ejecutivo asignado, ramo, tag), orden, paginación. Cada fila enlaza a la ficha.
  Acción de exportar a CSV. `ejecutivo` ve su cartera por defecto.
- **Alta/edición:** formulario con React Hook Form + Zod. Persona vs empresa
  cambia campos. RUT validado y formateado (módulo 11). Región/comuna desde el
  catálogo. Contactos múltiples editables en el mismo formulario.
- **Ficha 360°** (`/clientes/[id]`): cabecera (nombre, RUT, estado, ejecutivo),
  tabs: Resumen, Contactos, Pólizas, Propuestas, Siniestros, Documentos,
  Actividad. En este sub-proyecto Pólizas/Propuestas/Siniestros/Documentos
  muestran estado vacío ("sin registros / módulo próximamente"); Contactos y
  Actividad son funcionales.
- Cada alta/edición/cambio de estado escribe un `ActivityLog`.

## 11. Búsqueda global

Input siempre visible en el shell. En este sub-proyecto busca sobre `Client`
(nombre, RUT, email) vía `/api/search` usando full-text de Postgres / `ILIKE`
indexado. Diseñada para extenderse a propuestas, pólizas y siniestros después.

## 12. Validación y manejo de errores

- Validación con Zod en el límite (server actions y route handlers); el mismo
  schema alimenta los formularios.
- Server actions devuelven un resultado tipado `{ ok: true, data } | { ok: false,
  error }`; nunca lanzan al cliente sin envolver.
- Errores de unicidad (RUT duplicado por org) se mapean a mensajes de campo.
- Estados de UI: loading (Skeleton), vacío, y error con reintento.

## 13. Testing

- `lib/rut.ts`: validación y formato de RUT chileno (dígito verificador).
- Extensión multi-tenant de Prisma: un tenant no ve datos de otro.
- Server actions de Clientes: alta, edición, validación, bitácora.
- Componentes clave: formulario de cliente, render del listado.
- Objetivo: cubrir lógica de negocio y el contrato de aislamiento de tenant.

## 14. Despliegue

- `Dockerfile` multi-stage, Next.js `output: 'standalone'`.
- `docker-compose.yml` levanta Postgres para desarrollo local.
- Variables en `.env` (nunca commiteado); `.env.example` versionado.
- Migraciones Prisma versionadas; `prisma migrate deploy` en arranque de prod.

## 15. Criterios de aceptación

- Un usuario puede registrarse, crear su corredora y entrar.
- Un `admin` puede invitar usuarios con rol y estos aceptan e ingresan.
- Datos de una corredora nunca son visibles para otra (verificado por test).
- Se pueden crear, editar y listar clientes persona y empresa con contactos.
- La ficha 360° muestra los datos del cliente y sus relaciones.
- La búsqueda global encuentra clientes por nombre/RUT/email.
- `pnpm build`, `pnpm lint` y `pnpm test` pasan.
- `docker compose up` levanta la app con Postgres en local.
