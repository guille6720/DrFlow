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

### Paso 1 — Inventario esquema (producción)

Ejecutar primero:

`supabase/migrations/rollback/VERIFY_PRODUCTION_SCHEMA_INVENTORY.sql`

| Resultado | Significado |
|-----------|-------------|
| `has_entitlement_subs = false` | Prod **no tiene 121** — **no** ejecutar solo 138 |
| `has_entitlement_subs = true` | Prod ya tiene entitlements — puede continuar con PRE-FLIGHT |

### Paso 1b — PRE-FLIGHT SQL

`supabase/migrations/rollback/VERIFY_PRODUCTION_BEFORE_138.sql`

- Si la query **2a** falla con `clinic_entitlement_subscriptions does not exist`, es normal: guardá resultados de **1**, **2b** y **3**.
- Guardar conteos y distribución de planes (`clinic_subscriptions` + trial en `clinics`).

### Paso 2 — Migraciones en orden (121 → 138)

La app del PR **requiere** el esquema de entitlements. En producción actual hay que aplicar **en orden numérico**:

`121` … `122` … `123` … `124` … `125` … `126` … `127` … `128` … `129` … `130` … `131` … `132` … `133` … `134` … `135` … `136` … `137` → **`138`**

**Usuario activo existente:** la migración **121** hace backfill idempotente de **todas** las clínicas ya creadas a plan **`legacy` + `active`** (acceso completo preservado). **138 no reasigna** esas filas.

> Ejecutar **un archivo por vez** en SQL Editor. Si alguno falla, **detener** y revisar el error antes de continuar.

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
