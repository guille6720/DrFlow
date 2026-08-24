# INFORME FINAL — PLANES DRFLOW

## 1. Resumen

La estructura comercial **DrFlow Essential / Pro** está **implementada en código y validada en staging** (rama `compliance/argentina-monetization`, migración **138** aplicada en Supabase Staging).

**Respuesta directa a “si lo subo a producción, ¿perjudica usuarios?”:**

> **No lo subas a producción todavía.**  
> Si se aplicara con cuidado, **no reasigna clínicas existentes** ni borra datos clínicos.  
> Pero hay **warnings reales** (cobro MP one-shot, cambio de matriz del plan comercial `pro`, deploy app+migración deben ir juntos).  
> Estado: **🟡 READY WITH WARNINGS** — apto para revisión/validación en staging, **no** para deploy producción sin checklist.

## 2. Plan Essential

| Ítem | Estado |
|------|--------|
| Precio promo ARS 25.000 | ✅ |
| Precio regular ARS 35.000 | ✅ |
| 6 meses promo | ✅ |
| 1 profesional | ✅ |
| Pacientes ilimitados | ✅ |
| HC / agenda / docs / consent / audit / export / receta local | ✅ (features core + enforcement existente) |
| Stats básicas | ✅ (`reports.basic`) |
| 5 GB | ✅ (`storage.max_mb = 5120`) |
| IA OFF | ✅ |
| Automatización / reportes avanzados OFF | ✅ |
| Copy ES | ✅ |

## 3. Plan Pro

| Ítem | Estado |
|------|--------|
| Precio promo ARS 40.000 | ✅ |
| Precio regular ARS 55.000 | ✅ |
| Hasta 5 profesionales | ✅ |
| IA ON + 1000/mes | ✅ |
| Resumen / assistant clínicos | ✅ (`ai.clinical_summary`, `ai.enabled`) |
| Automatización / reportes avanzados | ✅ |
| 25 GB | ✅ (`25600` MB) |
| Soporte prioritario (copy/metadata) | ✅ (posicionamiento; no ticket queue aparte) |
| Copy ES | ✅ |

## 4. Promoción de 6 meses

Cálculo exacto (server-side):

1. Al activar pago aprobado: `promo_started_at = now`.
2. `promo_ends_at = addBillingMonths(promo_started_at, 6)` — **meses de calendario UTC**, no 180 días fijos.
3. Snapshot en `clinic_subscriptions`: montos promo/regular + meses.
4. `resolveEffectivePrice`: si `at < promo_ends_at` → precio promo; si no → regular.
5. Upgrade Essential→Pro **conserva** el `promo_ends_at` original (no reinicia 6 meses).

**WARNING (crítico comercial):** Mercado Pago sigue siendo **Checkout Pro one-shot**. La “transición automática” al precio regular ocurre en el **próximo checkout/preferencia**, no como cargo recurrente MP sin intervención. No hay Preapproval en este corte.

## 5. Mercado Pago

- Monto resuelto en servidor (`resolveCheckoutAmountArs` + snapshot).
- Webhook HMAC + monto vs precio efectivo + idempotencia.
- Frontend no puede forjar plan/precio.
- SKUs históricos `solo|consultorio|clinica` siguen parseables.
- Cancelación paid-through (fase 21) intacta.

## 6. IA y límites

- Tope Pro: **1000** `ai.monthly_requests` vía entitlements + `consumeAddonUsage` (server).
- UI/API: mensaje **«Límite mensual de IA alcanzado»** en clinical-ai.
- Sin add-on de IA de pago nuevo (fuera de alcance).
- Tests unitarios de precio/seats/monto; el rechazo 1001 depende del RPC/metering existente (no inventar bypass).

## 7. Profesionales y almacenamiento

- Essential: 1 / Pro: 5 — enforcement server-side + mensajes ES.
- **No** se borran profesionales excedentes.
- Storage: límites en MB; medición incompleta → **fail-open** + WARNING; **nunca** borra archivos clínicos.

## 8. Upgrade/Downgrade

- Upgrade: conserva ventana promo; cobra Pro promo hasta la misma fecha.
- Downgrade: bloqueado si hay **>1** profesional activo; no destruye datos.
- Preferencia “próximo ciclo” documentada; con one-shot MP el cambio se concreta en el próximo pago/checkout.

## 9. Usuarios existentes

| Garantía | Cumplida |
|----------|----------|
| No migrar clínicas a Essential/Pro automáticamente | ✅ (138 no toca `clinic_entitlement_subscriptions` de clínicas) |
| Plan `legacy` conservado | ✅ |
| `trial` / `basic` / `premium` / `enterprise` no borrados | ✅ |
| `basic`/`premium` dejan de venderse en público (`is_public=false`) | ✅ (superadmin puede seguir asignando) |

**Efecto colateral si se aplica 138 en prod:** actualiza la **matriz de features del plan comercial `pro`** (más IA/storage). Cualquier clínica **ya asignada a `pro`** recibe esa matriz nueva (ampliación, no reducción típica). Clínicas en `legacy`/`basic`/`premium`/`trial` **no** se reasignan.

## 10. Migraciones

- Nueva: `138_commercial_essential_pro.sql` (no edita 100–137).
- Staging: **aplicada** (columnas promo + plan essential + matriz).
- Producción: **no aplicada** (correcto).
- Verify: `VERIFY_138_commercial_essential_pro_staging.sql`.

## 11. Tests

- `tests/commercial-essential-pro.test.ts`: m1/m6/m7 Essential y Pro, upgrade sin reinicio, seats, monto manipulado, map legacy, SQL sin DELETE clínicas.
- Billing / MP / monetization / migrations-consistency actualizados.
- `npm run commercial:gate` pasó en la corrida de implementación.

## 12. Riesgos o warnings

1. **MP one-shot ≠ cobro recurrente automático** al pasar a precio regular.
2. **Storage** enforcement puede ser parcial (WARNING, fail-open).
3. Deploy **app sin 138** → fallos al persistir `essential`/`pro` en `clinic_subscriptions`.
4. Deploy **138 sin app** → catálogo DB listo, UI vieja sigue vendiendo Solo/Consultorio.
5. Clínicas ya en comercial `pro` ganan capacidades nuevas (IA) — revisar costo/expectativa.
6. Historial de migraciones staging incompleto para `db push` full (110–120); 138 se aplicó selectiva.

## 13. Impacto sobre usuarios

**MEDIUM** (si se desplegara a producción hoy).

- **Datos clínicos / pacientes / HC:** impacto **LOW** (sin DELETE, sin reasignación masiva).
- **Comercial / cobro / expectativa de features:** impacto **MEDIUM** (nuevo catálogo, matriz Pro, trial 14d para altas nuevas, marketing Essential/Pro).
- **Usuarios legacy:** impacto **LOW** si no se los reasigna; deben permanecer en su plan.

## 14. Estado para producción

🟡 **READY WITH WARNINGS**

Checklist mínimo antes de producción (no ejecutado aquí):

1. Inventario de planes reales en prod (`legacy`/`basic`/`pro`/`premium`/…).
2. Confirmar que clínicas `pro` actuales aceptan la nueva matriz (IA 1000 / 25 GB).
3. Aplicar 138 **solo** tras backup + ventana + gates anti-prod.
4. Deploy app + migración **en el mismo corte**.
5. Smoke: `/planes`, checkout Essential, webhook sandbox, clínica legacy intacta.
6. Comunicar copy promo vs regular.

---

### Checklist del brief (¿está todo?)

| Fase | Estado |
|------|--------|
| 1 Audit / reutilizar entitlements | ✅ |
| 2 Modelo Essential/Pro + legacy | ✅ |
| 3 Snapshot promo en suscripción | ✅ |
| 4–6 Precio 6 meses + snapshot | ✅ (server) |
| 7–8 Entitlements Essential/Pro | ✅ |
| 9 IA 1000 | ✅ |
| 10 Profesionales | ✅ |
| 11 Storage | ⚠️ WARNING si metering incompleto |
| 12–13 MP + webhook | ✅ |
| 14 Transición precio | ⚠️ próximo checkout, no Preapproval |
| 15–17 UI / billing / superadmin | ✅ (ES) |
| 18–20 Upgrade / downgrade / cancel | ✅ |
| 21 Tests | ✅ (núcleo; ampliar 1001 RPC si se desea) |
| 22–23 Migración + reporte clínicas | ✅ staging / script report |
| 24 Copy comercial | ✅ |
| 25 Validación + informe | ✅ staging; **no prod** |

---

No realicé cambios en producción. La implementación quedó preparada para revisión y validación en staging.
