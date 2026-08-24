# INFORME FINAL — DRFLOW ARGENTINA

> Branch: `compliance/argentina-monetization`  
> Fecha: 2026-08-24  
> **No constituye asesoramiento legal, contable ni certificación AAIP/REFEPS.**  
> **No se desplegó a producción.**

Catálogo técnico: `src/core/compliance/final-report-argentina.ts`

---

## 1. Resumen ejecutivo

DrFlow cuenta con **controles técnicos sólidos** para cobro SaaS controlado (Mercado Pago, entitlements no forgeables, RLS, sanitización IA, storage privado, cancelación self-serve, gate comercial automatizado).

Pendientes **externos** (abogado, contador, DPA, AAIP) y algunos tests unitarios **preexistentes** impiden declarar “listo legal/fiscal total”.

### 🟡 APTO CON PENDIENTES

---

## 2. Cambios realizados

Se ejecutó el plan de compliance Argentina (fases ~1–30) sobre staging/local:

- Endurecimiento de **RLS / tenant**, auditoría inmutable, retención y protección de HC.
- Consentimientos, derechos ARCO, exports/storage seguros, headers/rate-limit/SSRF, secretos.
- IA: sanitización + fail-safe; protocolos de investigación **OFF** por defecto.
- Recetas: etiquetado **local/borrador**; sin simular homologación REFEPS.
- Monetización: HMAC webhook, monto vs catálogo, cancelación, past_due en refunds, postura ARCA.
- Documentación legal borrador, registro subprocesadores, checklist AAIP, gate comercial, testing, migraciones 132–137 verificadas en staging, impacto y preservación de usuarios, informe final.

---

## 3. Archivos modificados

Ámbitos principales (lista no exhaustiva del working tree):

| Ámbito | Ejemplos |
|--------|----------|
| Compliance core | `src/core/compliance/*` (27 módulos) |
| Billing | `subscription-service.ts`, `billing.ts`, webhook/create-preference |
| Configuración UI | `clinic-plan-panel.tsx`, cancel button, privacy/consent panels |
| IA / Gemini | `run-gemini-clinical.server.ts`, sanitize, research gate |
| Recetas | PDF/print/UI labels locales |
| Storage/export | `export-staging.ts`, attachments, migration 136 |
| Docs | `docs/compliance/*`, `docs/legal/*` |
| Scripts | `commercial-release-gate.mjs`, `verify-compliance-migrations-staging.mjs` |
| Tests | `tests/*fase*.test.ts`, csrf/migrations adjustments |
| DB | `supabase/migrations/132`–`137` + `rollback/` |

También hay cambios colaterales en actions/páginas del dashboard (entitlements, imports, etc.) en el mismo branch.

---

## 4. Migraciones creadas

| Migración | Propósito |
|-----------|-----------|
| `132_audit_log_security.sql` | Integridad INSERT auditoría + RLS/REVOKE |
| `133_tenant_isolation_public_api.sql` | Gate multi-tenant en RPCs `api_*` |
| `134_consent_management.sql` | Retiro/purpose/source + inmutabilidad consentimientos |
| `135_privacy_rights_requests.sql` | Cola ARCO + RLS |
| `136_storage_security.sql` | Bucket privado + path kinds |
| `137_subscription_cancellation.sql` | Acceso paid-through si `canceled` |

Rollbacks en `supabase/migrations/rollback/`.  
**Staging verify 2026-08-24:** todos los flags de objetos presentes; clínicas/pacientes/HC intactos.  
**Producción: no aplicada.**

---

## 5. Seguridad

| Área | Estado |
|------|--------|
| RLS crítico | PASS (manifest + tests estáticos) |
| Tenant / API pública | PASS (migración 133 + tests) |
| Auth | Rate-limit/CSRF; sin cambio de IdP |
| Storage | PASS (`public=false`, path-aware) |
| Audit trail | PASS (inmutabilidad + integridad INSERT) |
| Secretos | PASS (escaneo / sin hardcode en trackeado) |
| Gate comercial | PASS (`npm run commercial:gate`) |

WARNING: CSP con `unsafe-inline`; tests XSS allowlist preexistentes en rojo.

---

## 6. Inteligencia Artificial

**Puede salir** (si la clínica activa proveedor): texto clínico **sanitizado** (nombres/DNI/contacto redactados), consultas del médico, stats con pacientes tokenizados.

**Protecciones:** `sanitizeClinicalAIInput`, bloqueo 422 si falla, auditoría sin prompts, investigación clínica OFF por defecto, BYOK documentado.

**No garantiza** cero re-identificación teórica por el proveedor. DPA Google: EXTERNAL.

---

## 7. Historia Clínica Electrónica

| Tema | Estado |
|------|--------|
| Integridad / lifecycle | Controles técnicos implementados |
| Trazabilidad | `clinical_record_audit` + audit logs |
| Retención | Configurable (default 10 años) |
| Versionado / no hard-delete | Soft/archive; ARCO no destruye HC automáticamente |
| Firma digital con validez legal | EXTERNAL ACTION REQUIRED |

---

## 8. Receta electrónica

**DrFlow NO puede afirmar emisión legal de receta electrónica oficial** sin homologación REFEPS/RENaPDiS externa.

Producto: **RECETA LOCAL / BORRADOR**; adapter REFEPS marcado como tal; sin fingir aprobación gubernamental.

---

## 9. Monetización

- Checkout con `clinicId` de sesión + CSRF.
- Webhook HMAC; secret obligatorio en producción.
- Idempotencia `payment_id`; monto vs catálogo; entitlements vía RPC service_role.
- Cancelación self-serve; refund → `past_due`.
- Entitlements **no forgeables** desde el cliente.

---

## 10. Facturación

MP ≠ factura fiscal. **REQUIERE CONTADOR:** vendedor legal, CUIT, condición ARCA, actividad, electrónica, IVA, IIBB, Convenio Multilateral.  
Puerto `DeferredExternalFiscalInvoicingProvider` (sin CAE falso).

---

## 11. AAIP

Registro de bases: **GESTIÓN EXTERNA — NO SE RESUELVE CON CÓDIGO**.  
No se afirma inscripción. Ver `AAIP-CHECKLIST.md` (tareas técnicas vs externas).

---

## 12. Transferencias internacionales

Subprocesadores (registro Fase 23): Supabase, Vercel, Google Vertex, Mercado Pago, email, Sentry, Daily, Jitsi, WhatsApp, BYOK, REFEPS.

Jurisdicción/DPA mayormente **REQUIERE VERIFICACIÓN**. Sin analytics inventado.

---

## 13. Documentación legal

Borradores en `docs/legal/` (banner abogado obligatorio):

- TERMS-OF-SERVICE-DRAFT  
- PRIVACY-POLICY-DRAFT  
- DATA-PROCESSING-AGREEMENT-DRAFT  
- SUBPROCESSORS-DRAFT  
- SECURITY-ANNEX-DRAFT  
- AI-PROCESSING-NOTICE-DRAFT  

**Pendiente:** revisión de abogado en Argentina antes de uso comercial.

---

## 14. Tests

| Categoría | Resultado |
|-----------|-----------|
| Lint | **PASS** |
| Typecheck | **PASS** |
| Build | **PASS** |
| Commercial gate (blockers) | **PASS** |
| RLS estático | **PASS** |
| RLS JWT integration | **SKIP** (sin env) / WARNING |
| Tenant isolation | **PASS** |
| AI sanitization / failsafe | **PASS** |
| Authorization | **PASS** |
| Payment / webhook | **PASS** |
| Unit suite completa | **FAIL parcial** (preexistentes: navegación HC, xss-audit, dashboard paint) |
| Staging migrations verify | **PASS** |

---

## 15. Impacto sobre usuarios existentes

| Categoría | Nivel |
|-----------|-------|
| Database | MEDIUM |
| Authentication | LOW |
| Clinic | MEDIUM |
| Patient data | MEDIUM |
| Subscription | **HIGH** |
| UI | MEDIUM |
| API | MEDIUM |

**Overall HIGH** por billing (monto catálogo, cancelación, past_due). HC no destruida.

---

## 16. BLOQUEANTES PARA PRODUCCIÓN

**Técnicos (gate):** ninguno abierto si `commercial:gate` sigue en PASS.

**Comercialización plena / ops:**

1. Revisión abogado de documentos legales (borradores).  
2. Facturación ARCA / contador.  
3. DPA con subprocesadores internacionales (esp. Google/Supabase/Vercel).  
4. Análisis/registro AAIP (si aplica).  
5. Ejecutar RLS JWT en staging antes de prod.  
6. Resolver o aceptar deuda tests preexistentes (XSS allowlist, navegación).  
7. **No deploy prod sin autorización explícita del titular.**

---

## 17. GESTIONES EXTERNAS OBLIGATORIAS

| Acción | Autoridad | Por qué | ¿Bloquea monetizar? | Evidencia a obtener |
|--------|-----------|---------|---------------------|---------------------|
| Revisar/aprobar términos, privacidad, DPA, aviso IA | Abogado AR | Uso comercial / Ley 25.326 | Sí para “pleno” | Versión firmada/aprobada |
| Definir CUIT/vendedor/ARCA/IVA/IIBB | Contador | Factura fiscal | Sí para operación regular | Alta ARCA / procedimiento |
| Firmar DPA subprocesadores | Abogado + proveedores | Transferencias / salud | Sí si datos salen AR | Contratos DPA |
| Evaluar registro bases AAIP | Abogado / AAIP | Posible obligación | Según análisis | Constancia o dictamen |
| Homologación REFEPS | Ministerio / legal | Solo si se vende “oficial” | Solo ese claim | Aprobación formal |
| Comunicación a clínicas de pago | Operaciones | Impacto HIGH suscripción | Recomendado | Nota a clientes |

---

## 18. RECOMENDACIÓN FINAL

### ¿Puedo comenzar a cobrar clientes reales en Argentina?

### YES WITH CONDITIONS

**Sí, de forma controlada y acotada**, si:

1. `npm run commercial:gate` sigue en PASS.  
2. Webhook MP + secret en el entorno de cobro.  
3. Aceptás que **no** hay factura ARCA automática ni documentos legales finales.  
4. Comunicás cancelación/monto a clientes.  
5. No afirmás REFEPS oficial ni registro AAIP hecho.  
6. Abogado/contador avanzan en paralelo.

**No** para “lanzamiento comercial pleno / compliance total” sin gestiones externas.

---

No realicé cambios en producción. Quedo a la espera de autorización para la siguiente etapa.
