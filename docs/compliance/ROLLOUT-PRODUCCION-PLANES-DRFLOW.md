# Rollout producción — Planes Essential/Pro (usuarios existentes intactos)

**Objetivo:** landing `/planes` + app para **nuevos** logins con Essential/Pro, **sin** cambiar plan ni entitlements de clínicas ya activas.

**Producción:** `https://drflow.opusorg.com` · Supabase `nipqdarduknydqptqzup` · Vercel deploy desde rama **`main`**.

---

## Garantías para el usuario activo actual

La migración **`138_commercial_essential_pro.sql`**:

| Acción | ¿Afecta clínicas existentes? |
|--------|------------------------------|
| INSERT plan `essential` en catálogo | No — solo catálogo |
| UPDATE matriz `pro` (features globales) | Solo si esa clínica ya está en plan comercial **`pro`** |
| UPDATE `basic`/`premium` `is_public=false` | No cambia asignación |
| Columnas `promo_*` en `clinic_subscriptions` | Nullable; filas existentes quedan NULL |
| UPDATE `clinic_entitlement_subscriptions` | **NO** — no hay en 138 |
| DELETE clínicas / pacientes / HC | **NO** |

Clínicas en **`legacy`**, **`basic`**, **`premium`**, **`trial`**: **siguen con el mismo plan** hasta que paguen/checkout o superadmin reasigne.

Lo que **sí** cambia para todos (solo UI/marketing):

- `/planes` muestra Essential/Pro
- Trial **14 días** para **altas nuevas** (no retroactivo sobre `trial_ends_at` existente)
- Pantalla de plan puede mostrar Essential/Pro para quien **aún no pagó**

---

## Orden recomendado (seguro)

### Paso 0 — Backup

Supabase Production → **Database → Backups** (snapshot manual si está disponible).

### Paso 1 — PRE-FLIGHT SQL (producción)

Ejecutar en SQL Editor **Production**:

`supabase/migrations/rollback/VERIFY_PRODUCTION_BEFORE_138.sql`

Guardar conteos y distribución de planes.

### Paso 2 — Migración 138 (solo esta, si prod ya tiene 100–137)

En SQL Editor Production, pegar y ejecutar **solo**:

`supabase/migrations/138_commercial_essential_pro.sql`

> Si producción está muy atrás en migraciones, resolver primero el backlog con el equipo — no mezclar sin inventario.

### Paso 3 — POST-FLIGHT SQL

`supabase/migrations/rollback/VERIFY_PRODUCTION_AFTER_138.sql`

Comparar: mismos `clinics` / `patients` / `clinical_records` y **misma** fila `plan_key` por clínica activa.

### Paso 4 — Deploy app (Vercel producción)

1. Merge PR `compliance/argentina-monetization` → `main` (revisado).
2. Vercel despliega `main` automáticamente **o** `node scripts/deploy-vercel.mjs`.
3. Verificar `https://drflow.opusorg.com/planes` → Essential/Pro.
4. Login usuario activo → agenda/HC funcionan; plan comercial sigue **legacy** (o el que tenía).

### Paso 5 — Mercado Pago (solo nuevos pagos)

En Vercel **Production** env:

- `MP_ACCESS_TOKEN` o `MERCADOPAGO_ACCESS_TOKEN` (Access Token válido)
- `MP_WEBHOOK_SECRET` apuntando a `https://drflow.opusorg.com/api/billing/webhooks/mercadopago`

Checkout no afecta al usuario legacy hasta que **él** elija pagar un plan.

---

## Smoke test post-deploy

| Quién | Qué verificar |
|-------|----------------|
| Visitante anónimo | `/planes` Essential + Pro, trial 14 días |
| Usuario activo existente | Mismo acceso clínico; plan entitlement sin cambio |
| Alta nueva | Trial 14d; puede elegir Essential/Pro |
| Superadmin | `/superadmin/clinics` — clínica legacy intacta |

---

## Rollback

- **App:** revert merge en `main` y redeploy Vercel.
- **DB 138:** parcial — ver `rollback/138_commercial_essential_pro.down.sql` (no borra essential ni reasigna clínicas).

---

## Impacto

- **Usuario activo legacy:** **LOW** si PRE/POST coinciden.
- **Nuevos usuarios:** **MEDIUM** (nuevo catálogo y precios).
- **Producción global:** **MEDIUM** (app + catálogo DB; sin migración masiva de clínicas).
