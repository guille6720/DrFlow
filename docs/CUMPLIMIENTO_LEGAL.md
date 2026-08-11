# Cumplimiento legal DrFlow (Argentina) — estudio e implementación

**Fecha:** 2026-07-27  
**Versión documentos:** `2026-07-27` (`src/lib/legal/documents.ts`)

Este documento resume el marco aplicable, el gap analysis y lo implementado en producto. **No reemplaza asesoramiento jurídico** ante un estudio local.

---

## 1. Marco normativo relevante (resumen operativo)

| Norma | Aplicación en DrFlow |
|--------|----------------------|
| **Ley 25.326** (Datos personales) + AAIP | Responsable = consultorio; encargado = DrFlow. Derechos ARCO, seguridad, finalidad, consentimiento cuando corresponda. |
| **Ley 26.529** (Derechos del paciente) | Confidencialidad, acceso a HC, consentimiento informado en actos médicos. |
| **Ley 25.649** (Prescripción genérica) | Recetas con nombre genérico; módulo recetas locales con disclaimer explícito. |
| **REFEPS / RENaPDiS** | Adapter DrFlow (sandbox/API) + disclaimer; homologación MSN del consultorio sigue siendo requisito legal. |
| **Retención HC** | Práctica habitual ≥ 10 años | Años configurables (5–30) + panel cumplimiento + baja lógica trazable |

---

## 2. Estado previo (gap analysis)

| Requisito | Antes | Después (esta entrega) |
|-----------|--------|-------------------------|
| Política de privacidad | Piloto breve | Texto ampliado v2026-07-27 |
| Términos consultorio | No | `/terminos` |
| Aviso al paciente | No | `/aviso-paciente` |
| Consentimiento turno web | No | Checkbox + RPC `record_patient_data_consent` |
| Aceptación alta consultorio | No | Checkbox registro/onboarding + columnas `clinics.legal_*` |
| Registro consentimientos | Tabla vacía | Inserts en `consent_records` |
| Export Habeas Data | Parcial | JSON completo por paciente + export clínica (Configuración) |
| Logs acceso datos sensibles | No | `recordSensitiveAccess` — view en fichas, HC, docs admin; panel Configuración |
| Retención / baja paciente | Solo copy 10 años | Política configurable, estadísticas, baja lógica con ack + `deactivated_at` |
| Panel cumplimiento | No | Configuración → Cumplimiento legal + accesos sensibles |
| Receta REFEPS | Disclaimer local + adapter | Integración adapter (migración 102); homologación MSN pendiente por consultorio |
| Consentimiento informado acto médico | Paper / criterio médico | Flujo digital en consulta + PDF + `consent_records` |
| Inscripción bases AAIP encargado | Trámite administrativo | **Pendiente** (consultorio/proveedor) |
| DPA / contrato encargado | Legal externo | **Pendiente** |
| REFEPS integración | Roadmap | **Adapter implementado** — ver [REFEPS-INTEGRATION.md](./REFEPS-INTEGRATION.md) |

---

## 3. Implementación técnica (archivos)

### Base de datos
- `supabase/migrations/033_legal_compliance.sql`
  - `clinics.legal_terms_version`, `legal_terms_accepted_at`, `legal_privacy_version`
  - RPC `record_patient_data_consent` (anon + authenticated)

### Legal / producto
- `src/lib/legal/documents.ts` — versiones y tipos de consentimiento
- `src/app/privacidad/page.tsx` — política actualizada
- `src/app/terminos/page.tsx` — términos consultorio
- `src/app/aviso-paciente/page.tsx` — información al paciente
- `src/components/legal/legal-consent-fields.tsx` — checkboxes
- `src/components/legal/patient-arco-export-button.tsx`
- `src/core/legal/informed-consent.ts` — texto y versión del consentimiento informado
- `src/lib/actions/informed-consent.ts` — registro vinculado a consulta clínica
- `src/core/components/legal/informed-consent-panel.tsx` — UI en ficha/consulta
- `src/core/components/legal/export-informed-consent-pdf-button.tsx`
- `src/core/compliance/data-retention-policy.ts` — matriz de retención/eliminación
- `src/lib/actions/data-retention.ts` — actualizar años de retención, evaluación de baja
- `src/features/configuracion/components/configuracion/retention-policy-panel.tsx`
- `src/core/security/sensitive-access-audit.ts` — registro de lecturas (`view`) con dedupe 15 min
- `src/features/configuracion/server/load-clinic-sensitive-access-logs.ts`
- `src/features/configuracion/components/configuracion/sensitive-access-log-panel.tsx`

### Flujos
- `src/lib/actions/public-booking.ts` — valida consentimiento + registra RPC
- `src/lib/actions/compliance.ts` — aceptación clínica, export ARCO, resumen
- `src/lib/actions/auth.ts` — exige `legal_accepted` en alta
- `src/components/booking/public-booking-form.tsx`
- `src/app/(auth)/register/page.tsx`, `src/app/onboarding/onboarding-form.tsx`
- `src/app/(dashboard)/configuracion/page.tsx` — panel legal
- `src/app/(dashboard)/pacientes/[id]/page.tsx` — export ARCO
- `src/components/portal/patient-portal-view.tsx` — links legales
- `src/lib/supabase/middleware.ts` — rutas públicas `/terminos`, `/aviso-paciente`

### Ya existente (mantener)
- Recetas: checkbox disclaimer REFEPS (`prescription-form.tsx`)
- Auditoría: `audit_logs`, `clinical_record_audit`
- Trial comercial: `trial_ends_at`, `/trial-expirado`
- RLS multi-tenant

---

## 4. Despliegue obligatorio

1. Aplicar migración **033** en Supabase producción (`supabase db push` o SQL manual).
2. Deploy app (Vercel) con este commit.
3. Verificar turno público: checkbox + fila en `consent_records`.
4. Verificar registro: columnas `legal_*` en `clinics`.

---

## 5. Pendiente para “100% normativo” (fuera de código)

- Contrato de encargado de tratamiento (DPA) entre consultorio y DrFlow.
- Registro/inscripción ante AAIP si corresponde al responsable/encargado.
- Procedimiento escrito de respuesta a reclamos ARCO (plazos, responsable).
- Consentimiento informado **digital** por acto (firma, PDF) si el consultorio lo exige.
- Homologación REFEPS si se comercializa receta electrónica nacional.
- Seguro de responsabilidad profesional / ciberriesgos (consultorio).
- Revisión anual de textos legales con abogado de salud.

---

## 6. Checklist QA legal (manual)

- [ ] Registro nuevo consultorio sin checkbox → error
- [ ] Registro con checkbox → `clinics.legal_terms_accepted_at` poblado
- [ ] Turno web sin checkbox → error Zod
- [ ] Turno web OK → `consent_records` + `patient_data_processing_booking`
- [ ] Export ARCO en ficha → JSON descargado + `audit_logs` export
- [ ] Abrir ficha paciente (tab clínico) → `audit_logs` view con `access_kind`
- [ ] Abrir historia clínica → `audit_logs` view `clinical_record_detail`
- [ ] Abrir consulta en ficha → registrar consentimiento informado → fila en `consent_records`
- [ ] Configuración → retención: cambiar años (5–30) y ver estadísticas
- [ ] Dar de baja paciente con HC → exige checkbox + conserva consultas
- [ ] Panel Configuración muestra versiones y conteo consentimientos
- [ ] Links portal → aviso-paciente y privacidad
