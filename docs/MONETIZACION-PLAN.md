# DrFlow — Plan de monetización (Argentina)

**Objetivo:** pasar de trial gratuito a ingresos recurrentes con mínimo riesgo técnico y legal.

**Estado actual:** Fase 1 (manual) — página `/planes` + activación comercial.  
**Próximo:** Fase 2 — Mercado Pago Checkout + webhooks + desbloqueo automático.

---

## 1. Planes sugeridos (precios orientativos)

Definidos en código: `src/core/billing/plans.ts`

| Plan | Precio/mes (ARS) | Anual (2 meses off) | Incluye |
|------|------------------|---------------------|---------|
| **Solo** | $24.900 | $249.000 | 1 médico, core clínico |
| **Consultorio** | $49.900 | $499.000 | Hasta 3 profesionales, equipo, permisos |
| **Clínica** | $79.900 | $799.000 | Ilimitado, reportes, onboarding |

**Trial:** 10 días gratis (`TRIAL_PROMO_DAYS`), sin tarjeta → `/probar`.

Ajustá precios antes del primer cliente pago según:
- Costo Supabase + Vercel + email + IA
- Competencia local (Nimbo, Doctoralia, turneras + HC)
- Valor percibido (PAMI, portal paciente, IA)

---

## 2. Fase 1 — Monetizar YA (manual) ✅ implementado

### Flujo comercial

```
/probar → register (trial 10d) → uso → trial banner → /planes
                                              ↓
                                    WhatsApp / email ventas
                                              ↓
                              Link MP (Preference) manual
                                              ↓
                         Supabase: trial_ends_at = NULL o +365d
                                              ↓
                                    Cliente desbloqueado
```

### Qué ya está en producto

| Pieza | Ruta / archivo |
|-------|----------------|
| Landing precios | `/planes` — `src/app/planes/page.tsx` |
| Definición planes | `src/core/billing/plans.ts` |
| Trial | `src/core/trial/clinic-trial.ts` |
| Bloqueo post-trial | `/trial-expirado` |
| Banner días restantes | `src/core/components/trial/trial-banner.tsx` → link `/planes` |

### Activación manual en Supabase (hoy)

Cuando el cliente paga:

```sql
-- Opción A: quitar trial (acceso permanente hasta implementar suscripción)
UPDATE clinics
SET trial_ends_at = NULL,
    updated_at = now()
WHERE id = '<clinic_uuid>';

-- Opción B: extender 1 año
UPDATE clinics
SET trial_ends_at = (now() + interval '365 days')::timestamptz,
    updated_at = now()
WHERE id = '<clinic_uuid>';
```

Registrar en hoja de control: clínica, plan, monto, fecha MP, comprobante.

### Variables de entorno (Vercel)

```env
NEXT_PUBLIC_SALES_EMAIL=ventas@opusorg.com
NEXT_PUBLIC_SALES_WHATSAPP=54911XXXXXXXX   # E.164 sin +
```

Sin WhatsApp configurado, los botones abren wa.me con mensaje prellenado para elegir contacto.

---

## 3. Fase 2 — Mercado Pago automático (2–3 semanas dev)

### 3.1 Modelo de datos (migración propuesta)

```sql
-- 074_clinic_subscriptions.sql (propuesta)

CREATE TYPE clinic_subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled', 'manual'
);

CREATE TABLE clinic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL, -- solo | consultorio | clinica
  status clinic_subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- monthly | annual
  mercado_pago_preapproval_id TEXT,
  mercado_pago_payer_email TEXT,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id)
);

CREATE TABLE clinic_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  mercado_pago_payment_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  status TEXT NOT NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Actualizar `clinic_subscription_active()` en Postgres:

```sql
-- Activo si: trial vigente OR subscription.status = 'active' AND period_end > now()
```

### 3.2 Integración Mercado Pago (Checkout Pro)

**Docs:** https://www.mercadopago.com.ar/developers/es/docs/checkout-pro

| Paso | Implementación |
|------|----------------|
| 1 | Cuenta MP Developers + app producción |
| 2 | Env: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PUBLIC_KEY` |
| 3 | `POST /api/billing/create-preference` — crea Preference con `external_reference=clinic_id:plan_id` |
| 4 | Redirect success → `/configuracion?pago=ok` |
| 5 | `POST /api/billing/webhooks/mercadopago` — idempotente, verifica firma |
| 6 | On `approved`: upsert subscription, `trial_ends_at = NULL`, audit log |
| 7 | Email recibo vía `transactional-email.ts` |

**SKU → Preference:** usar `mercadoPagoPreferenceSku` de cada plan en `plans.ts`.

### 3.3 UI

- Botón **「Pagar con Mercado Pago」** en `/planes` (junto a WhatsApp)
- En `/configuracion` → sección **「Tu plan」** con estado y próximo vencimiento
- Trial expirado → CTA directo a MP checkout del plan elegido

### 3.4 Seguridad

- Webhook solo server-side con `SUPABASE_SERVICE_ROLE_KEY`
- Verificar `x-signature` MP
- No confiar en query params de success URL sin confirmar payment_id en API MP
- Idempotency key = `mercado_pago_payment_id`

---

## 4. Fase 3 — Escala (opcional)

- Suscripciones recurrentes (Preapproval API MP)
- Panel superadmin: listar clínicas, MRR, activar/suspender
- Factura AFIP automática (integración tercero)
- DPA template + firma digital
- Sentry + alertas billing failed

---

## 5. Legal antes de cobrar

| Documento | Estado |
|-----------|--------|
| Términos uso consultorio | ✅ `/terminos` |
| Privacidad | ✅ `/privacidad` |
| **Términos de venta / suscripción** | ❌ Crear (precio, renovación, cancelación, reembolsos) |
| **DPA encargado tratamiento** | ❌ Template legal |
| Factura B2B | Proceso manual Fase 1 |

Texto sugerido para términos de venta (resumen):
- Precio en ARS, IVA según corresponda
- Renovación automática mensual/anual salvo cancelación 7 días antes
- Trial 10 días, conversión automática solo si aceptó checkout (Fase 2)
- Datos conservados 30 días post-cancelación

---

## 6. Checklist lanzamiento comercial

### Antes del primer peso

- [ ] Precios finales en `plans.ts`
- [ ] `NEXT_PUBLIC_SALES_WHATSAPP` y email en Vercel prod
- [ ] Migraciones **071–073** aplicadas en Supabase prod
- [ ] Proceso interno: quién activa clínica post-pago (< 24 h)
- [ ] Link MP listo (Preference por plan)
- [ ] Términos de venta publicados

### Fase 2 MP automático

- [ ] Migración 074 subscriptions
- [ ] Webhook en prod + MP dashboard apuntando a `/api/billing/webhooks/mercadopago`
- [ ] Test pago sandbox → desbloqueo
- [ ] Test trial expirado → checkout → acceso

---

## 7. KPIs a medir

| Métrica | Meta inicial |
|---------|--------------|
| Trial → activación manual | > 15% |
| Churn mensual | < 5% |
| Tiempo activación post-pago | < 24 h (Fase 1), < 1 min (Fase 2) |
| MRR | tracking manual → dashboard Fase 3 |

---

## 8. Referencias en repo

| Tema | Archivo |
|------|---------|
| Planes UI | `src/app/planes/page.tsx` |
| Precios código | `src/core/billing/plans.ts` |
| Trial | `src/core/trial/clinic-trial.ts` |
| Mock pagos paciente | `src/lib/services/payments.ts` (no confundir con SaaS) |
| Legal | `docs/CUMPLIMIENTO_LEGAL.md` |
| Producción | `docs/PRODUCTION.md` |
