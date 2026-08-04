# Producción — DrFlow (Fase 18)

Runbook para despliegue, salud del sistema y backups. La instancia principal sigue en **Vercel**; Docker es opción self-hosted.

---

## Arquitectura

| Componente | Producción actual | Alternativa |
|------------|-------------------|-------------|
| App Next.js | Vercel (`gru1`) | Docker / `docker compose` |
| Base de datos | Supabase Postgres | Misma instancia Supabase |
| Auth / Storage | Supabase | — |
| Cron jobs | Vercel Cron (`vercel.json`) | Cron externo o `docker compose` + scheduler |
| CI | GitHub Actions | — |

Ver también: [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)

---

## Variables de entorno

Copiá `.env.example` → `.env.local`.

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | Cliente Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Cliente Supabase |
| `NEXT_PUBLIC_SITE_URL` | Sí | OAuth, emails, health probe prod |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod (jobs/cron) | Worker, observabilidad, imports |
| `CRON_SECRET` | Prod (cron) | Protege `/api/jobs/process`, purge |
| `DATABASE_URL` | Backup/migrate | Connection string Postgres (Supabase Dashboard) |

---

## Health checks

### Endpoints

- `GET /api/health` — latencia Supabase, memoria, service role configurado
- `GET /api/health?persist=1` — igual + evento en `clinic_observability_events` (cron horario)
- `GET /api/version` — versión y changelog para PWA

### Script local / ops

```powershell
npm run check:health
npm run check:health -- --url=https://drflow.opusorg.com
npm run check:health -- --url=https://drflow.opusorg.com --strict
```

`--strict` falla si `ok=false` (útil para uptime monitors).

### Vercel Cron

En `vercel.json`:

- Jobs: cada minuto → `/api/jobs/process`
- Health persist: cada hora → `/api/health?persist=1`
- Purge telemetría: diario 04:00 UTC → `/api/observability/purge`

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. Smoke: `next start` + `npm run check:health`

Cada push a `main` dispara deploy en Vercel si el repo está conectado.

---

## Docker (self-hosted)

Requiere `output: "standalone"` en `next.config.ts` (Fase 18).

```powershell
npm run docker:build
docker run --env-file .env.local -p 3000:3000 drflow-app
```

O con Compose:

```powershell
npm run docker:run
```

La base de datos **no** corre en Docker: apuntá las mismas variables Supabase en `.env.local`.

Healthcheck del contenedor: `GET /api/health` cada 60s.

---

## Backups

### Supabase managed

Supabase Pro incluye backups automáticos diarios (Dashboard → Database → Backups).

### Backup manual (pg_dump)

1. Obtené `DATABASE_URL` en Supabase → Project Settings → Database → URI
2. Agregala a `.env.local`
3. Instalá [PostgreSQL client tools](https://www.postgresql.org/download/) (`pg_dump` en PATH)

```powershell
npm run backup:db
npm run backup:db -- --out=backups/mi-backup.sql
```

Los archivos van a `backups/` (gitignored).

### Restaurar (solo entornos de prueba)

```powershell
psql $DATABASE_URL -f backups/archivo.sql
```

> No restaures sobre producción sin ventana de mantenimiento y backup previo.

---

## Checklist pre-deploy

```powershell
npm test
npm run build
npm run check:supabase
npm run check:health -- --url=https://drflow.opusorg.com --strict
```

Migraciones pendientes: ver [MIGRATIONS.md](./MIGRATIONS.md) y `scripts/run-migrations.mjs`.

---

## Monitoreo externo (opcional)

Configurá un monitor HTTP (UptimeRobot, Better Stack, etc.) contra:

- `https://drflow.opusorg.com/api/health` — alerta si HTTP ≠ 200
- `https://drflow.opusorg.com/api/version` — detecta deploys

Telemetría interna: Configuración → Observabilidad (Fase 16).
