# VALIDACIÓN STAGING — PLANES DRFLOW

Fecha: 2026-08-24  
Rama: `compliance/argentina-monetization` (`19b2fb4`)  
Proyecto DB: DrFlow-Staging `gprmsufvhabntbrytwyi`  
Producción: **no modificada**

## Veredicto

**🟡 VALIDACIÓN STAGING APROBADA CON WARNINGS**

La implementación Essential/Pro pasó gates técnicos, tests comerciales, verificación SQL 138 y preservación de clínicas legacy.  
**No** está lista para producción sin checklist adicional (ver sección final).

---

## Resultados ejecutados

| Control | Resultado |
|---------|-----------|
| `npm run supabase:preflight:staging` | ✅ PASS (linked staging, no prod) |
| `npm run commercial:gate` | ✅ PASS (94 tests bloqueantes) |
| Vitest comercial/billing/MP/cancel/migrations | ✅ 66/66 (+ gate 94) |
| ESLint módulos billing/MP/trial/UI plan | ✅ PASS |
| `tsc --noEmit` | ✅ PASS |
| Smoke `resolveEffectivePrice` (tsx) | ✅ Essential m1=25000, m7=35000; Pro m1=40000; promo Sep15→Mar15 |
| Downgrade con 3 profesionales | ✅ bloqueado (mensaje ES) |
| Map legacy `solo→basic` | ✅ |
| Vercel deploy rama | ✅ success (dashboard deployment) |

### Base de datos staging (138)

| Check | Resultado |
|-------|-----------|
| Plan `essential` público activo | ✅ |
| Plan `pro` público (matriz retune) | ✅ professionals=5, storage=25600, ai=1000 |
| Essential: AI off, 1 seat, 5 GB | ✅ |
| `basic`/`premium` `is_public=false` | ✅ |
| `legacy` intacto | ✅ |
| Columnas `promo_*` + `price_currency` | ✅ |
| Clínicas reasignadas a Essential/Pro | ❌ ninguna (correcto) |
| Suscripciones entitlement | 2× **legacy** / active |
| Preservación | **2** clínicas, **130** pacientes, **552** HC |

---

## Clasificación de clínicas staging (sin PHI)

| Categoría | Cantidad | Notas |
|-----------|----------|-------|
| Legacy unaffected | 2 | Plan comercial `legacy`, status active |
| Essential/Pro pagas | 0 | Aún no hay altas nuevas Essential/Pro |
| Exceso seats vs futuro Essential | N/A en auto-migración | No se migró; revisar solo si se asignara Essential a mano |
| Anomalía MP | 0 vistas en sample | `clinic_subscriptions` vacío o sin anomalía reportada en este corte |

---

## Warnings (no bloquean staging)

1. **Mercado Pago one-shot:** la transición promo→regular aplica en el **próximo checkout**, no como cargo recurrente automático.
2. **Storage:** enforcement fail-open si la medición es incompleta; no borra archivos clínicos.
3. **EXTERNAL ACTION REQUIRED** (gate comercial): abogado/AAIP/ARCA/REFEPS — no son bugs de código.
4. Informe markdown local tiene cambios no commiteados respecto al push (`INFORME-FINAL-PLANES-DRFLOW.md`).

---

## Cómo validar en UI (preview)

1. Abrí el deploy exitoso: https://vercel.com/guillermo-c-bmw/drflow-app/GsmHfGefJuiHsxr3bbXYmqd2WTvu  
2. Entrá al **Visit** / Preview URL del deploy.
3. Revisá:
   - `/planes` → Essential / Pro, promo + “Luego $X”, trial 14 días
   - Login → `/configuracion?grupo=consultorio&seccion=plan`
   - Superadmin → `/superadmin/clinics` (billing/promo/usos)
4. Confirmá que clínicas legacy siguen operando (agenda/HC) sin cambio de plan.

---

## Estado para producción

**🔴 NOT READY** para deploy producción en este momento (aunque staging esté OK).

Antes de prod hace falta:

1. Inventario de planes reales en **producción**
2. OK explícito a retune del plan comercial `pro` (IA/storage)
3. Backup + aplicar 138 solo en prod con gates
4. Deploy app + migración juntos
5. Smoke legacy + checkout Essential en prod/sandbox

---

No realicé cambios en producción. La implementación quedó preparada para revisión y validación en staging.
