# Polizza — Contexto para Claude

SaaS multi-tenant de gestión para corredoras de seguros chilenas. Cliente
piloto en staging: corredora chilena que viene migrando desde Brokeris/Brider.

## Stack

- **Next.js 15** App Router con `output: "standalone"`
- **TypeScript** estricto, **React 19**
- **Prisma 6** + **PostgreSQL 16**
- **Better Auth** (email/password) con organizaciones y miembros
- **TailwindCSS 4** + **Radix UI** + **shadcn-style** primitives (en `src/components/ui/`)
- **react-hook-form** + **zod**
- **@react-pdf/renderer** para PDFs
- **xlsx** para carga masiva
- **Resend** para email (transport configurable)
- **mindicador.cl** para UF / Dólar Observado / Euro
- **pnpm 10** como package manager
- **Vitest** para tests

## Layout del proyecto

```
src/
  app/
    (app)/          # rutas autenticadas con sidebar (clientes, propuestas, pólizas...)
    (auth)/         # login, registro, restablecer
    admin/          # rutas SaaS-admin (User.isSuperadmin = true)
    api/            # route handlers (auth, search, cotizaciones, pdf)
  features/         # feature folders: queries.ts, actions.ts, schemas.ts, components/
    clients/
    proposals/        # carátula propuesta
    proposal-items/   # ítems con ficha dinámica por ramo
    proposal-coverages/ # coberturas con cálculo prima/IVA/comisión
    proposal-pdf/     # @react-pdf/renderer + envío email
    payment-plan/     # plan pago + bitácora
    endorsements/     # endosos de póliza (cancelación/anulación/modificación)
    saas-admin/       # CRUD globales para superadmin
    tenant-config/    # adopt/custom de compañías y productos por corredora
    policies/, claims/, billing/, branches/, holdings/,
    car-quotes/, catalog/, documents/, insurer-credentials/
  components/       # UI compartida (sidebar, topbar, badges, banners)
  lib/              # utilidades puras (rut, money, uf, permissions, roles)
  server/           # server-only (db, auth, context, email, uf, activity)
prisma/
  schema.prisma     # 30+ modelos (multi-tenant + globals)
  migrations/       # historial de migraciones
  seed.ts           # base CL (monedas, feriados)
  seed-globals.ts   # 15 ramos + 132 campos + 13 cías globales
tests/              # Vitest (88 tests)
```

## Comandos

```bash
# Dev local
pnpm dev                          # next dev en :3000

# DB
pnpm db:migrate                   # prisma migrate dev (crear migración nueva)
pnpm db:deploy                    # prisma migrate deploy (aplicar en staging/prod)
pnpm db:seed                      # prisma/seed.ts (idempotente)
pnpm db:studio                    # Prisma Studio

# Build + tests
pnpm build                        # prisma generate && next build
pnpm test                         # vitest run
pnpm lint                         # next lint
```

## Multi-tenant

Todas las tablas de dominio llevan `organizationId`. El aislamiento se aplica
vía `getDb(organizationId)` en `src/server/db.ts` con `$extends.query` que
inyecta `organizationId` automáticamente en `where/data` de operaciones sobre
los modelos del set `TENANT_MODELS`.

**Excepciones (tablas globales sin tenant):**
`Currency`, `ExchangeRate`, `Holiday`, `GlobalInsuranceCompany`, `BranchType`,
`BranchFieldSchema`, `GlobalInsuranceProduct`, `GlobalProductCoverage`,
todas las tablas de Better Auth.

**SaaS-admin**: usuarios con `User.isSuperadmin = true`. Se gatea con
`requireSuperadmin()` en `src/server/context.ts`. Solo ellos pueden acceder a
`/admin/*` y editar los catálogos globales.

## Servidor de staging

- **URL**: https://poliza.100aventuras.cl
- **IP**: 161.35.229.180 (DigitalOcean droplet)
- **Acceso**: `ssh root@161.35.229.180` (clave pública)
- **Usuario de app**: `ai`
- **Path**: `/home/ai/apps/poliza`
- **Servicio systemd**: `poliza.service` (puerto interno 3040)
- **Nginx**: termina TLS, proxy_pass a `127.0.0.1:3040`
- **DB**: PostgreSQL local `poliza`
- **Postgres user**: `postgres` (peer auth desde `su - postgres`)

## DEPLOY a staging — pasos manuales

```bash
# 1. Sincronizar código (excluye .next, node_modules, .git, .env)
rsync -az --delete \
  --exclude '.next' --exclude 'node_modules' --exclude '.git' \
  --exclude 'tsconfig.tsbuildinfo' --exclude '.env' --exclude '.claude*' \
  -e ssh /Users/jpreyest/work/seguros/ \
  root@161.35.229.180:/home/ai/apps/poliza/

# 2. Reasignar ownership y construir (todo en un ssh)
ssh root@161.35.229.180 '
  chown -R ai:ai /home/ai/apps/poliza
  su - ai -c "cd /home/ai/apps/poliza && \
    pnpm install --frozen-lockfile 2>&1 | tail -3 && \
    pnpm build 2>&1 | tail -3 && \
    cp -r public .next/standalone/ 2>/dev/null; \
    cp -r .next/static .next/standalone/.next/ 2>/dev/null; \
    echo done"
'

# 3. Si hay migraciones nuevas:
ssh root@161.35.229.180 'su - ai -c "cd /home/ai/apps/poliza && pnpm db:deploy"'

# 4. Si hay cambios en el seed (ramos, compañías globales, etc.):
ssh root@161.35.229.180 'su - ai -c "cd /home/ai/apps/poliza && pnpm db:seed"'

# 5. Reiniciar el servicio y verificar
ssh root@161.35.229.180 'systemctl restart poliza && sleep 3 && systemctl is-active poliza'

# 6. Smoke test
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://poliza.100aventuras.cl/login
```

### Deploy completo en un solo comando

```bash
rsync -az --delete \
  --exclude '.next' --exclude 'node_modules' --exclude '.git' \
  --exclude 'tsconfig.tsbuildinfo' --exclude '.env' --exclude '.claude*' \
  -e ssh /Users/jpreyest/work/seguros/ \
  root@161.35.229.180:/home/ai/apps/poliza/ && \
ssh root@161.35.229.180 '
  chown -R ai:ai /home/ai/apps/poliza && \
  su - ai -c "cd /home/ai/apps/poliza && \
    pnpm install --frozen-lockfile 2>&1 | tail -3 && \
    pnpm build 2>&1 | tail -3 && \
    cp -r public .next/standalone/ 2>/dev/null; \
    cp -r .next/static .next/standalone/.next/ 2>/dev/null; \
    pnpm db:deploy 2>&1 | tail -3 && \
    pnpm db:seed 2>&1 | tail -2 && \
    echo done" && \
  systemctl restart poliza && sleep 3 && systemctl is-active poliza
' && \
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://poliza.100aventuras.cl/login
```

### Por qué Next standalone + copy public/static

`next.config.ts` tiene `output: "standalone"`. Esto genera `.next/standalone/`
con un `server.js` autocontenido. **Pero** Next no copia automáticamente
`public/` ni `.next/static/` ahí — hay que copiarlos a mano post-build. El
servicio systemd ejecuta `node /home/ai/apps/poliza/.next/standalone/server.js`,
no `next start`.

### Verificar logs en staging

```bash
ssh root@161.35.229.180 'journalctl -u poliza -n 100 --no-pager'
ssh root@161.35.229.180 'journalctl -u poliza -f'   # follow
```

### Consultar la DB en staging

```bash
ssh root@161.35.229.180 'su - postgres -c "psql poliza"'

# Una query rápida:
ssh root@161.35.229.180 'su - postgres -c "psql poliza -c \"SELECT COUNT(*) FROM \\\"Proposal\\\";\""'
```

### Promover un usuario a superadmin (manual una sola vez)

```bash
ssh root@161.35.229.180 'su - postgres -c "psql poliza -c \"UPDATE \\\"User\\\" SET \\\"isSuperadmin\\\" = true WHERE email = \\x27TU_EMAIL@aqui.cl\\x27;\""'
```

## Variables de entorno (servidor)

En `/home/ai/apps/poliza/.env` (NO se sincroniza vía rsync — está excluido):

```
DATABASE_URL=postgresql://...@localhost:5432/poliza
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://poliza.100aventuras.cl
NEXT_PUBLIC_APP_URL=https://poliza.100aventuras.cl

# Email (opcional). Si no se setea EMAIL_TRANSPORT=resend, los emails se loguean
# por consola (útil en dev).
EMAIL_TRANSPORT=resend
RESEND_API_KEY=re_...
EMAIL_FROM="Polizza <no-reply@polizza.cl>"

# Crypto AES-256-GCM para credenciales de portales aseguradoras
INSURER_CREDS_KEY=<base64 32 bytes>
```

Para agregar/cambiar vars sin tirar el servicio:
```bash
ssh root@161.35.229.180 'nano /home/ai/apps/poliza/.env && systemctl restart poliza'
```

## Convenciones de código

- **server-only**: archivos en `src/server/` y `queries.ts` llevan `import "server-only"` arriba
- **Server actions**: archivos `actions.ts` con `"use server"` arriba, usan `requireOrgDb()`
- **Multi-tenant**: usar `db` (no `basePrisma`) para tablas del dominio
- **organizationId**: PASARLO EXPLÍCITO en `db.X.create({ data: { organizationId: ctx.organizationId, ... } })` — el extends valida pero TS no lo infiere
- **Decimal**: campos monetarios usan `Prisma.Decimal`, convertir con `Number()` al exponer al cliente
- **Fechas**: `db.Date` para días puros, `DateTime` para timestamps
- **Naming**: archivos en kebab-case, exports en PascalCase, funciones en camelCase
- **Paths**: `@/` resuelve a `src/`

## Modelos clave (resumen)

| Modelo | Scope | Notas |
|---|---|---|
| `Organization`, `Member`, `User` | Better Auth | `User.isSuperadmin` = flag SaaS-admin |
| `Client` | tenant | con `holdingId`, `assignedUserId`, tipo PERSONA/EMPRESA |
| `InsuranceCompany` | tenant | `globalCompanyId?` → si null, custom |
| `GlobalInsuranceCompany` | global | maestro SaaS-admin |
| `BranchType`, `BranchFieldSchema` | global | 15 ramos + ficha de datos por ramo |
| `InsuranceProduct` | tenant | hereda de `GlobalInsuranceProduct` o custom |
| `Proposal` | tenant | + 20 campos del doc (vigencia, sentAt, recipientEmail, coaseguro, etc.) |
| `ProposalItem` | tenant | `data` JSON validado contra BranchFieldSchema |
| `ProposalItemCoverage` | tenant | cálculo prima neta + IVA + comisión |
| `PaymentPlan` | tenant | modalidad + datos pagador, genera Installments |
| `ProposalLog` | tenant | bitácora automática + manual |
| `Policy`, `Endorsement` | tenant | cancelación/anulación cambian status |
| `Installment` | tenant | `paymentPlanId` y/o `policyId` |

## Comportamiento crítico que debe respetarse

1. **Crear cliente inline**: `QuickClientDialog` en propuestas crea Client con
   status `PROSPECTO`. Si el RUT ya existe en la org, devuelve el existente
   (P2002 → fallback al existente).

2. **Conversión Propuesta → Póliza** (`/polizas/nuevo?fromProposal=X`):
   precarga items + coverages desde `ProposalItem*`, totaliza prima neta. Al
   crear la póliza vincula `PaymentPlan.policyId` y reasigna las
   `Installments` desde `paymentPlanId` a `policyId`. Marca propuesta como
   `EMITIDA` y registra `CONVERTED_TO_POLICY` en bitácora.

3. **Endosos**: CANCELACION → `Policy.status = CANCELADA`,
   ANULACION → `ANULADA`, MODIFICACION → solo registra. Borrar el último
   endoso de tipo cancelación/anulación revierte a `VIGENTE`.

4. **PDF**: ruta `/api/propuestas/[id]/pdf` con `renderProposalPdf` que llama
   `renderToBuffer`. Si `Proposal.hasStoredPdf` es true se sirve el guardado;
   si no, el de elaboración puede generarse on-demand.

5. **Email**: `sendProposalByEmailAction` envía PDF como adjunto + documentos
   subidos como links en el body. Cambia status a `ENVIADA_COMPANIA` y
   registra en bitácora. `markOnly` solo registra sin enviar.

6. **mindicador.cl**: `getIndicatorValues()` fetches UF + dolar + euro cada
   6h. Caída de red es tolerada (usa último valor almacenado).

## Backup rápido de DB en staging

```bash
ssh root@161.35.229.180 'su - postgres -c "pg_dump poliza"' > "backup-$(date +%Y%m%d-%H%M).sql"
```

## Restore

```bash
scp backup-YYYYMMDD-HHMM.sql root@161.35.229.180:/tmp/
ssh root@161.35.229.180 'su - postgres -c "psql poliza < /tmp/backup-YYYYMMDD-HHMM.sql"'
```

## Cuando algo se rompe en staging

1. `ssh root@161.35.229.180 'journalctl -u poliza -n 50 --no-pager'` — ver últimos logs
2. `ssh root@161.35.229.180 'systemctl status poliza --no-pager'` — estado del servicio
3. Si el build falló en el deploy, sigue corriendo la versión anterior
4. Para rollback rápido: vuelve a hacer rsync desde un checkpoint anterior local o `git checkout <sha-anterior>` y redeploy

## Routes principales

| Ruta | Rol | Descripción |
|---|---|---|
| `/login`, `/registro` | público | auth |
| `/panel` | logged | dashboard |
| `/clientes` | logged | CRUD clientes 360° |
| `/holdings` | logged | grupos económicos |
| `/cotizaciones` | logged | cotizaciones auto |
| `/propuestas` | logged | Kanban + lista + creación |
| `/propuestas/[id]` | logged | detalle con ítems/coberturas/plan/bitácora |
| `/polizas` | logged | cartera de pólizas |
| `/polizas/nuevo?fromProposal=X` | logged | crear/convertir desde propuesta |
| `/renovaciones` | logged | tablero de renovaciones |
| `/siniestros` | logged | gestión de siniestros |
| `/cobranza` | logged | cuotas pendientes |
| `/tareas` | logged | tareas del usuario |
| `/configuracion/companias` | admin | adopt globales + custom + contactos |
| `/configuracion/productos` | admin | adopt + custom + override % comisión |
| `/configuracion/portales` | admin | credenciales cifradas portales aseguradoras |
| `/admin/companias` | superadmin | maestro global de compañías |
| `/admin/productos` | superadmin | maestro global de productos + coberturas |
| `/admin/ramos` | superadmin | ramos + editor de fichas dinámicas |

## Cosas que NO hacer

- **No** correr `pnpm db:migrate` en staging (es `db:deploy`, no `dev`)
- **No** commit `.env`
- **No** push --force a main
- **No** crear migraciones manuales en `prisma/migrations/` — siempre con `prisma migrate dev` o `prisma migrate diff`
- **No** usar `basePrisma` para escribir en tablas tenant — usar `db` de `requireOrgDb()`
- **No** hacer `db.create({ data: { ... } })` sin pasar `organizationId` explícito
