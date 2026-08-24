# AUDITORÍA FASE 1 — LEGAL / TÉCNICA — DrFlow Argentina

> **Estado:** Informe de auditoría previo a implementación comercial.
> **Fecha:** 2026-08-22
> **Rama:** `compliance/argentina-monetization`
> **Commit base:** `b6b99215`
> **Entorno auditado:** `DrFlow-staging` (NO producción)

**IMPORTANTE:** Este informe describe hallazgos técnicos y de diseño. **No constituye asesoramiento legal** ni certifica cumplimiento normativo. La existencia de controles técnicos no implica conformidad con Ley 25.326, Ley 26.529, Ley 27.706, AAIP, REFEPS/RENaPDiS ni obligaciones fiscales.

---

## 0. Verificación de entorno

| Elemento | Valor |
|----------|-------|
| Repositorio | `guille6720/DrFlow` → local `DrFlow-staging` |
| Supabase staging | `gprmsufvhabntbrytwyi` |
| Supabase producción | `nipqdarduknydqptqzup` — **no auditado en vivo** |
| Migraciones | 001–129 |
| Tablas con RLS (manifest CI) | 80+ |

---

## 1. Autenticación y autorización

### Implementado (técnico)

| Control | Estado | Referencia |
|---------|--------|------------|
| Supabase Auth (email/password) | ✅ | `src/core/supabase/` |
| Cookie clínica activa (`drflow_clinic_id`) | ✅ | `middleware.ts` |
| Roles: superadmin, clinic_admin, doctor, secretary, patient | ✅ | `src/core/permissions/roles.ts` |
| 22 permisos granulares + overrides por miembro | ✅ | `member-permissions.ts` |
| Secretaría excluida de PHI clínico | ✅ | `can_view_clinical()` |
| CSRF en mutaciones API | ✅ | `requireSameOriginMutation` |
| Límite sesiones por dispositivo (máx. 3) | ✅ | `device-sessions.ts` |
| Entitlements comerciales por plan | ✅ | `src/core/entitlements/` |

### Gaps

| Hallazgo | Clasificación | Severidad |
|----------|---------------|-----------|
| MFA TOTP habilitado en Supabase config pero **sin UI ni enforcement en app** | Técnico + legal | MEDIA |
| Superadmin vía flag `profiles.is_superadmin` | Técnico | BAJA (documentar procedimiento) |

---

## 2. RLS y aislamiento multi-tenant

### Implementado

- RLS en 80+ tablas verificadas por CI (`tests/rls-policies.test.ts`)
- Helpers SECURITY DEFINER: `user_clinic_ids()`, `can_view_clinical()`, `can_write_clinical()`
- Hardening en migraciones 045, 053, 058, 090
- Storage path-aware: `{clinic_id}/clinical/...`
- Capa app: `tenant-scope.ts`, `ownership-guard.ts`

### Gaps

| Hallazgo | Severidad |
|----------|-----------|
| Tests cross-tenant con JWT real solo opcionales (`DRFLOW_RLS_INTEGRATION=1`) | ALTA |
| Service role bypass RLS — depende de validación app | MEDIA |
| Manifest CI no cubre tablas 103–129 (os_fee_schedules, clinic_api_keys, etc.) | MEDIA |
| `clinical-reset.ts` borra HC con service role (herramienta migración) | ALTA |

---

## 3. Historias clínicas, pacientes, turnos

### Historias clínicas

| Aspecto | Estado |
|---------|--------|
| Sin DELETE en RLS | ✅ Inmutable |
| Versionado vía `clinical_record_audit` | ✅ Snapshots old/new |
| RPCs atómicas create/update | ✅ `063_atomic_operations.sql` |
| Campos: motivo, diagnóstico, evolución, indicaciones | ✅ Texto libre |

### Pacientes

| Aspecto | Estado |
|---------|--------|
| DNI (`document_number`), email, teléfono, dirección | ✅ Tabla `patients` |
| Soft delete (`is_active`, `deactivated_at`) | ✅ `099_data_retention_policy.sql` |
| Acknowledgment retención al desactivar con HC | ✅ `settings.ts` |

### Turnos

| Aspecto | Estado |
|---------|--------|
| Aislamiento por `clinic_id` | ✅ RLS |
| Turnos web públicos con consentimiento | ✅ `public-booking.ts` |
| Notificaciones email/WhatsApp | ✅ Ver sección salidas |

---

## 4. Recetas y órdenes médicas

| Aspecto | Estado |
|---------|--------|
| Motor prescripción (ambulatoria, crónica, duplicado) | ✅ `features/recetas/` |
| Disclaimer REFEPS/no homologación | ✅ `ARGENTINA_PRESCRIPTION_DISCLAIMER` |
| Integración REFEPS adapter (sandbox) | ⚠️ Parcial |
| Homologación regulatoria oficial | ❌ **NO VERIFICADA** — GESTIÓN EXTERNA |
| `prescription_events` sin trigger inmutable | ⚠️ Gap menor |

**Clasificación:** Funcionalidad interna permitida como borrador. Validez legal ante farmacias: **REQUIERE HOMOLOGACIÓN REGULATORIA**.

---

## 5. Notas clínicas y texto libre

- Evoluciones, motivos, indicaciones: texto libre en `clinical_records`
- Sanitización display: `sanitizeClinicalDisplayText()` (XSS)
- **Riesgo IA:** médico puede escribir PHI en texto libre → mitigado por `sanitizeClinicalAIInput()` (post-auditoría fase 3)
- Dictado por voz: Web Speech API del navegador → audio/texto puede salir al proveedor del OS

---

## 6. Auditoría

### Implementado

| Tabla | Inmutabilidad | Contenido |
|-------|---------------|-----------|
| `audit_logs` | ✅ Trigger anti UPDATE/DELETE | Acciones, metadata, IP, user-agent |
| `clinical_record_audit` | ✅ | Snapshots HC completos |

- Escritura centralizada: `audit-service.ts`
- Acceso sensible con dedupe: `sensitive-access-audit.ts`
- Auditoría IA (sin prompts): `ai-audit.ts` (añadido en rama compliance)

### Gaps

| Hallazgo | Severidad |
|----------|-----------|
| Fallo de insert audit es non-blocking (mutación puede proseguir) | MEDIA |
| Médicos con `can_view_clinical` leen audit_logs completos | MEDIA |
| Sin retención/purge de audit_logs (permanente por diseño) | INFO |

---

## 7. Storage y adjuntos

| Control | Estado |
|---------|--------|
| Bucket `clinical-files` privado | ✅ |
| Políticas path-aware por clínica | ✅ `053` |
| MIME allowlist (PDF, imágenes, CSV staging) | ✅ |
| Signed URLs con expiración | ✅ |
| Validación upload en app | ✅ `file-upload.ts` |

**Gap:** `application/octet-stream` permitido — superficie de riesgo mitigada por RLS.

---

## 8. Exportaciones de datos

| Tipo | Permiso | Auditoría | Datos |
|------|---------|-----------|-------|
| Padrón CSV/XLSX | `exportPatients` | ✅ | DNI, email, tel, dirección |
| HC individual PDF/JSON/FHIR/ZIP | `exportClinicalRecords` | ✅ | PHI completo |
| Export masivo async | `bulkExportData` | ✅ | Jobs + staging storage |
| ARCO/Habeas Data JSON | compliance action | ✅ | PHI + metadata auditoría |

**Controles:** entitlements, tenant isolation, auth requerida. **Riesgo:** descarga local fuera de control de DrFlow post-export.

---

## 9. Eliminación y retención

| Categoría | Política | Enforcement automático |
|-----------|----------|------------------------|
| HC, recetas, auditoría, consentimientos | Inmutable | N/A (no se borra) |
| Ficha paciente | Soft delete | ✅ Manual |
| Retención años (default 10) | Configurable 5–30 | ⚠️ Solo declarativo/UX |
| Purga post-retención | No implementada | ❌ |

**Distinción legal crítica:** Derecho de acceso/corrección del titular ≠ destrucción de historia clínica cuando hay obligación de conservación (Ley 26.529).

---

## 10. Consentimiento

| Flujo | Mecanismo | Versionado |
|-------|-----------|------------|
| Turno web | RPC `record_patient_data_consent` (anon) | ✅ `document_version` |
| Consentimiento informado | RPC `record_informed_consent` | ✅ Por acto clínico |
| Términos signup clínica | Columnas `legal_*` en `clinics` | ✅ |
| Receta disclaimer | Checkbox `disclaimer_accepted` | ✅ |

### Gaps

- `consent_records` SELECT-only (bien); escritura solo RPC (bien)
- Sin flujo de revocación documentado
- `record_patient_data_consent` expuesto a `anon` — riesgo spam si DNI+slug conocidos
- Tipo `clinic_terms_signup` definido pero no siempre insertado en DB al registrar

---

## 11. Documentos legales

| Documento | Publicado in-app | Revisión abogado |
|-----------|------------------|------------------|
| Términos | ✅ `/terminos` v2026-08-01 | ⚠️ Borradores en `docs/legal/` pendientes |
| Privacidad | ✅ `/privacidad` | ⚠️ Sin subprocesadores enumerados |
| Aviso paciente | ✅ `/aviso-paciente` | ⚠️ |
| DPA | ❌ No publicado | Borrador en `docs/legal/` |
| Términos de venta/suscripción | ❌ | GESTIÓN EXTERNA |

**Clasificación:** REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA.

---

## 12. Inteligencia Artificial / Gemini

### Puntos de salida

| Path | Destino | Datos | Controles |
|------|---------|-------|-----------|
| `/api/clinical-ai` | Vertex/Gemini/BYOK | Texto clínico sanitizado | Permisos, entitlements, sanitización, fail-safe |
| `runGeminiClinicalChat` | Google | Contexto anonimizado, stats tokenizadas | `sanitizeClinicalAIInput` |
| BYOK (OpenAI/Anthropic/Gemini) | Proveedor elegido | Contexto sanitizado | Credenciales en DB |
| `run-ai-task` job | Idem | Resúmenes clínicos | Sanitización |
| Admin-ops AI | **Ninguno** | Rule-based local | ✅ |
| Pharmacology API | **Ninguno** | Solo Supabase RPC | ✅ |
| Voice STT | Navegador/OS | Audio clínico | Client-side |

### Post-implementación (rama compliance)

- `sanitizeClinicalAIInput()` centralizado
- Fail-safe 422 si PII residual
- `recordAiAuditEvent()` sin prompts
- Flag `clinical_research_protocols` default OFF

### Clasificación

- Controles técnicos: **implementables** ✅
- DPA Google Cloud, base legal transferencia internacional: **GESTIÓN EXTERNA** ⚠️
- Texto clínico (diagnósticos, evoluciones) **sí puede salir** anonimizado — no eliminado

---

## 13. Mercado Pago y suscripciones

| Control | Estado |
|---------|--------|
| Checkout Pro | ✅ |
| Webhook HMAC | ✅ |
| Idempotencia pagos | ✅ |
| Re-fetch pago desde API MP | ✅ |
| Entitlements server-side | ✅ |
| Validación monto vs catálogo | ❌ **GAP** |
| Preapproval/recurring | ❌ Fase 3 pendiente |
| Dualidad `clinic_subscriptions` vs `clinic_entitlement_subscriptions` | ⚠️ |

---

## 14. Facturación fiscal

**REQUIERE CONTADOR** — Sin integración ARCA. Comprobantes MP ≠ factura fiscal.

---

## 15. Email, WhatsApp, telemedicina

| Canal | Destino | PHI típico | En subprocesadores.ts |
|-------|---------|------------|----------------------|
| Email (Resend/SMTP) | Proveedor email | Nombres, turnos, **contraseña en invitaciones** | ✅ |
| WhatsApp Cloud API | Meta | Nombres, turnos, recetas | ❌ **FALTA** |
| wa.me (manual) | Navegador operador | Recetas, diagnósticos | Sin trazabilidad server |
| Jitsi (default) | `meet.jit.si` | Video/audio consulta | ❌ **FALTA** |
| Daily.co (opcional) | Daily API | Idem | ✅ |

---

## 16. API pública v1

- Expone DNI, teléfono, email a integradores con API key
- Controles: hash SHA-256, scopes, rate limit, entitlement
- **Riesgo:** seguridad depende del integrador de la clínica

---

## 17. REFEPS

- Payload completo con PHI hacia API externa
- **GESTIÓN REGULATORIA** — homologación no verificada
- Ver `docs/compliance/RECETA-ELECTRONICA-ARGENTINA.md`

---

## 18. Observabilidad, logging, backups

| Sistema | Destino | Riesgo PHI |
|---------|---------|------------|
| `audit_logs`, `clinical_record_audit` | Supabase | Contiene PHI — inmutable |
| `clinic_observability_events` | Supabase | Bajo |
| Sentry (opcional) | Sentry.io | **ALTO** — sin scrubbing PHI explícito |
| Backups | Supabase managed | REQUIERE VERIFICACIÓN región/DPA |

**Analytics de terceros (GA, Mixpanel, etc.):** No detectados en código.

---

## 19. Secretos

| Verificación | Resultado |
|--------------|-----------|
| Keys en código fuente | No detectadas |
| `.env.local` local | `VERCEL_OIDC_TOKEN` — no commitear |
| Tests usan valores fake | ✅ |

**No se requiere ROTACIÓN DE CREDENCIALES** por exposición en repo en esta auditoría.

---

## 20. Mapa de salidas de datos (resumen)

```
DrFlow
├── Supabase (siempre) ───────────── PHI completo
├── Vercel (hosting) ─────────────── tránsito
├── Google Vertex/Gemini (opcional) ─ texto clínico sanitizado
├── BYOK IA (opcional) ───────────── texto clínico sanitizado
├── Mercado Pago ─────────────────── datos pago (no PHI)
├── Email SMTP/Resend ────────────── PII moderado
├── Meta WhatsApp ────────────────── PII + recetas
├── REFEPS API ───────────────────── PHI completo recetas
├── Jitsi/Daily ──────────────────── audio/video
├── Sentry ───────────────────────── riesgo PHI en errores
├── API pública v1 ───────────────── PHI hacia integrador
└── Exportaciones/descargas ──────── PHI → dispositivo usuario
```

---

## 21. Clasificación por tipo de requisito

### Implementable técnicamente
- Sanitización IA, fail-safe, auditoría IA
- Validación monto webhook MP
- MFA en UI
- Scrubbing Sentry
- Completar manifest RLS
- Tests cross-tenant JWT
- Registrar subprocesadores faltantes (Meta, Jitsi, REFEPS)

### Requiere documentos legales
- Términos, privacidad, DPA, aviso IA, términos de venta
- Política de cancelación B2B/B2C

### Requiere registros/trámites ante autoridades
- AAIP (posible registro bases de datos)
- REFEPS/RENaPDiS (receta electrónica oficial)

### Requiere contador
- Facturación ARCA, IVA, IIBB, CUIT vendedor

### Requiere aprobación regulatoria salud
- Homologación receta electrónica
- Firma digital con validez legal

---

## 22. Hallazgos prioritarios

### P0 — Bloqueantes o alto riesgo

1. Documentos legales sin revisión de abogado
2. DPA/transferencias internacionales sin cerrar (Supabase, Google, Vercel)
3. Facturación ARCA sin definir (REQUIERE CONTADOR)
4. Tests cross-tenant reales no ejecutados en staging
5. Webhook MP sin validación de monto
6. `clinical-reset.ts` puede borrar HC masivamente

### P1 — Alto / medio

7. Sentry sin scrubbing PHI
8. WhatsApp/Meta/Jitsi/REFEPS no en registro subprocesadores
9. Invitaciones con contraseña en texto plano por email
10. MFA no enforced
11. Dualidad sistemas suscripción
12. IA envía texto clínico (anonimizado) — requiere base legal

### P2 — Mejoras

13. Retención declarativa sin purge automática
14. Rate limit RPC públicas
15. CSP `unsafe-inline`
16. Consentimiento signup no persistido en `consent_records`

---

## 23. Veredicto Fase 1

| Dimensión | Evaluación |
|-----------|------------|
| Seguridad técnica base | **Sólida** — RLS, auditoría, storage, permisos |
| Privacidad / minimización | **Mejorable** — múltiples salidas PHI, algunas sin DPA |
| Cumplimiento legal | **Incompleto** — documentos en borrador, trámites pendientes |
| Monetización técnica | **Factible con condiciones** — gaps MP y legal/contable |

**La implementación técnica existente NO certifica cumplimiento legal para comercialización en Argentina.**

---

*Próxima fase recomendada: Fase 2 (mapa de flujo detallado) ya documentado en `DATA-FLOW-ARGENTINA.md`; o remediación P0 según prioridad del titular del proyecto.*
