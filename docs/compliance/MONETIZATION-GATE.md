# Gate de liberación comercial — DrFlow Argentina

> Evaluación técnica para monetización. **No equivale a cumplimiento legal total.**  
> Fase 25 — gate documentado + automatizado (`npm run commercial:gate`).

Última evaluación: 2026-08-24 | Branch: `compliance/argentina-monetization`

Catálogo: `src/core/compliance/commercial-release-gate.ts`  
Script: `scripts/commercial-release-gate.mjs`

---

## Criterios de evaluación

| Categoría | Significado |
|-----------|-------------|
| **PASS** | Listo técnicamente |
| **WARNING** | Funcional con riesgo residual — documentar |
| **BLOCKER** | No comercializar hasta resolver *(técnico; falla `commercial:gate`)* |
| **EXTERNAL ACTION REQUIRED** | Gestión fuera del código (legal/contable/AAIP) — **separado** de blockers técnicos |

---

## BLOCKERs técnicos (mínimo — bloquean comercialización)

Si falla cualquiera de estos, **no comercializar** desde ingeniería:

| Condición | Suite / evidencia |
|-----------|-------------------|
| Tests de aislamiento cross-tenant fallan | `tenant-isolation-fase10.test.ts` |
| Políticas RLS críticas fallan | `rls-policies.test.ts` |
| Datos sensibles públicamente accesibles | `storage-security-fase14` (`public=false`) |
| Secretos expuestos | `secrets-security-fase16` + `security-gate.mjs` |
| IA envía datos identificables de paciente sin control | `sanitize-clinical-ai-input` + `clinical-ai-failsafe` |
| Entitlement de pago forgeable | `monetization-security-fase19` |
| Integridad del audit trail rota | `audit-log-security-fase9` + `prevent_audit_mutation` |

Automatización:

```bash
npm run commercial:gate
```

El script **falla (exit 1)** si señales estáticas o esos tests fallan.  
Los ítems **EXTERNAL ACTION REQUIRED** se listan al final **sin** hacer fallar el script.

---

## Checklist (snapshot)

### Seguridad y tenancy

| Ítem | Estado | Notas |
|------|--------|-------|
| RLS en tablas críticas | PASS | Manifest CI |
| Tests cross-tenant estáticos | PASS | `tenant-isolation-fase10` |
| Tests cross-tenant con JWT real | WARNING | `DRFLOW_RLS_INTEGRATION=1` |
| RPCs API pública tenant gate | PASS | Migración `133` |
| Aislamiento storage | PASS | Bucket privado |
| Audit logs inmutables | PASS | `prevent_audit_mutation` |
| Headers CSP/HSTS | WARNING | CSP con `unsafe-inline` |
| Secretos en repo | PASS | Fase 16 |

### Inteligencia Artificial

| Ítem | Estado | Notas |
|------|--------|-------|
| Sanitización server-side | PASS | `sanitizeClinicalAIInput()` |
| Fail-safe sanitización | PASS | HTTP 422 |
| Auditoría IA sin prompts | PASS | |
| Tokenización stats IA | PASS | |
| DPA Google Cloud | EXTERNAL ACTION REQUIRED | |
| Protocolos investigación | PASS | Flag default OFF |

### Historia clínica / receta

| Ítem | Estado | Notas |
|------|--------|-------|
| HC sin hard-delete | PASS | |
| Retención configurable | PASS | 10 años default |
| Firma digital legal | EXTERNAL ACTION REQUIRED | |
| Disclaimer receta local | PASS | |
| Homologación REFEPS | EXTERNAL ACTION REQUIRED | |

### Monetización

| Ítem | Estado | Notas |
|------|--------|-------|
| Webhook MP HMAC + secret prod | PASS | |
| Monto vs catálogo | PASS | Fase 19 |
| Entitlements no forgeables | PASS | |
| Cancelación self-serve | PASS | Fase 21 |
| Facturación ARCA | EXTERNAL ACTION REQUIRED | REQUIERE CONTADOR |
| Términos / privacidad / DPA | EXTERNAL ACTION REQUIRED / WARNING | Borradores Fase 22 |
| Derecho arrepentimiento B2B/B2C | EXTERNAL ACTION REQUIRED | |

### Legal / AAIP

| Ítem | Estado | Notas |
|------|--------|-------|
| Registro AAIP | EXTERNAL ACTION REQUIRED | GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO |
| Transferencias internacionales | EXTERNAL ACTION REQUIRED | |

---

## Separación importante

| Tipo | Efecto en `commercial:gate` |
|------|------------------------------|
| BLOCKER técnico | **Falla el script** → no release comercial técnico |
| EXTERNAL ACTION REQUIRED | Informativo — **no** se “arregla” con código |

---

## Veredicto técnico

🟡 **APTO CON PENDIENTES EXTERNOS** (si `npm run commercial:gate` pasa)

Controles técnicos de monetización/seguridad en orden para un lanzamiento controlado.  
La comercialización plena sigue dependiendo de abogado, contador, DPA y AAIP.

*No certifica cumplimiento legal ni fiscal.*
