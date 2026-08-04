# Disaster Recovery — DrFlow

Runbook para incidentes de producción: pérdida de servicio, corrupción de datos, rollback de aplicación y recuperación de base de datos.

**Instancia de referencia:** Vercel (`gru1`) + Supabase Postgres  
**Documentos relacionados:** [PRODUCTION.md](./PRODUCTION.md) · [PRODUCTION_READINESS_REPORT.md](../PRODUCTION_READINESS_REPORT.md)

---

## Objetivos de recuperación

| Métrica | Target enterprise | Actual (DrFlow) |
|---------|-------------------|-----------------|
| **RTO** (tiempo hasta servicio restaurado) | ≤ 4 h | ~30–60 min (rollback Vercel) + migraciones |
| **RPO** (pérdida máxima de datos) | ≤ 24 h | Supabase Pro: backup diario (~24 h); manual: según último `pg_dump` |

---

## Roles y escalamiento

1. **On-call técnico** — health checks, rollback app, comunicación interna
2. **DBA / Supabase admin** — restore Postgres, migraciones, verificación RLS
3. **Product / clínica** — aviso a usuarios, ventana de mantenimiento

---

## Escenario 1 — App caída (Vercel / Docker)

### Síntomas

- `/api/health/ready` → HTTP 503 o timeout
- Uptime workflow / monitor externo en alerta
- Usuarios no pueden iniciar sesión

### Diagnóstico

```powershell
npm run check:health -- --url=https://drflow.opusorg.com --strict
```

Revisar:

- Vercel → Deployments → último deploy (build failed?)
- Supabase Dashboard → Project status
- Variables de entorno en Vercel (¿faltan `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`?)

### Recuperación

1. **Rollback de aplicación** (ver sección Rollback abajo)
2. Si el fallo es de env: corregir secrets en Vercel → Redeploy
3. Si Docker self-hosted: `docker compose pull && docker compose up -d --build`
4. Confirmar: `GET /api/health/ready` → 200, `ok: true`

---

## Escenario 2 — Base de datos inaccesible

### Síntomas

- Health: `checks.supabase.ok: false`
- Errores 5xx en login y consultas

### Diagnóstico

- [Supabase Status](https://status.supabase.com)
- Dashboard → Database → Connection pooling / pausa por billing

### Recuperación

1. Esperar resolución de incidente Supabase (si regional)
2. Si proyecto pausado: reactivar plan / proyecto
3. Verificar conexión: `npm run check:supabase`
4. No aplicar migraciones hasta confirmar conectividad estable

---

## Escenario 3 — Migración fallida / schema corrupto

### Síntomas

- Errores SQL en app tras deploy + migrate
- Funciones RPC o RLS rotas

### Recuperación

1. **Detener deploys** adicionales
2. **Rollback app** al último deploy estable (antes de la migración)
3. **No** ejecutar `DROP` masivos en producción
4. Opciones DB:
   - **Forward fix:** migración correctiva (preferido) — ver `supabase/migrations/`
   - **Point-in-time restore:** Supabase Pro → Database → Backups → Restore to new project → cambiar `DATABASE_URL` / env Supabase en Vercel
5. Validar: `npm run test:rls`, smoke manual de login + consulta

### Migraciones recientes críticas

| Migración | Riesgo |
|-----------|--------|
| 053 | RLS / helpers seguridad |
| 054 | Índices, FKs |
| 055 | Audit inmutable — **no borrar filas de audit** |

---

## Escenario 4 — Pérdida de datos (usuario / clínica)

### Recuperación granular

1. Identificar `clinic_id` / `patient_id` afectados
2. Restaurar backup en **proyecto Supabase de staging** (nunca directo sobre prod)
3. Extraer filas necesarias con `COPY` o `INSERT ... SELECT`
4. Reinsertar en prod con ventana de mantenimiento y backup previo
5. Registrar en `audit_logs` / `clinical_record_audit` (inmutables desde 055)

---

## Rollback de aplicación

### Vercel (recomendado)

1. Vercel Dashboard → **Deployments**
2. Seleccionar último deployment **Ready** conocido estable
3. **⋯ → Promote to Production**
4. Verificar `/api/version` (versión esperada) y smoke clínico

Tiempo típico: **2–5 minutos**

### Docker self-hosted

```powershell
docker pull drflow-app:previous-tag
# o checkout git tag
git checkout v0.2.0
npm run docker:build
docker compose up -d
```

### Rollback NO recomendado

- Revertir migraciones SQL con scripts destructivos en caliente
- `git revert` + deploy sin probar migraciones forward-fix

---

## Restauración desde backup

### Supabase managed (Pro)

1. Dashboard → Database → **Backups**
2. Elegir punto de restauración
3. Restaurar a **nuevo proyecto** (Supabase no sobrescribe in-place)
4. Actualizar en Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
5. Redeploy + `npm run check:health --strict`

### Backup manual (`pg_dump`)

```powershell
npm run backup:db
# Restaurar solo en staging:
psql $STAGING_DATABASE_URL -f backups/drflow-YYYY-MM-DD.sql
```

> **Nunca** restaurar un dump completo sobre producción sin ventana de mantenimiento y backup previo.

---

## Comunicación durante incidente

Plantilla interna:

```
[INCIDENTE DrFlow] — <severidad P1/P2>
Inicio: <UTC-3>
Impacto: <login / consultas / turnos>
Estado: investigando | mitigando | resuelto
ETA: <opcional>
Acción usuario: <ninguna / usar portal alternativo>
```

---

## Checklist post-incidente

- [ ] Root cause documentado (issue interno)
- [ ] Health probes verdes 24 h
- [ ] Backup manual post-recuperación (`npm run backup:db`)
- [ ] Revisar si hace falta migración forward-fix
- [ ] Actualizar este runbook si el proceso cambió

---

## Contactos y enlaces

| Recurso | URL |
|---------|-----|
| Producción | `https://drflow.opusorg.com` |
| Health ready | `/api/health/ready` |
| Supabase Dashboard | Project Settings → Database |
| Vercel Deployments | Team → drflow-app |
| CI / Uptime | GitHub Actions → CI, Uptime |

---

*Última revisión: enterprise deployment prep — migraciones 055, audit inmutable, probes live/ready.*
