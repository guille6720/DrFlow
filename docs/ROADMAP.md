# Roadmap — DrFlow

> **Enterprise Transformation (20 fases):** completado — ver [ENTERPRISE_TRANSFORMATION.md](./ENTERPRISE_TRANSFORMATION.md)

## Ya construido (MVP + post-QA)

- [x] Agenda, pacientes, historia clínica, timer de consulta
- [x] Recetas locales (Ley 25.649) con disclaimer explícito (no REFEPS)
- [x] Portal paciente PWA + solicitud de turnos pública
- [x] Coberturas del consultorio (`accepted_coverages`) + copy PAMI condicional
- [x] Auth: login, registro 2 pasos, Google OAuth, recovery sin localhost
- [x] Atender ahora (dashboard) + renovación rápida de medicación
- [x] Atenciones: modalidad + resumen por cobertura + CSV
- [x] Labs colapsados (pagos mock, telemedicina, recordatorios) — no nav core
- [x] `/qa` solo superadmin

## Fase 1 — Estabilización

- [x] CI/CD con GitHub Actions (lint, test, build, smoke health) — ver [PRODUCTION.md](./PRODUCTION.md)
- [x] Cobertura 90% core lib + E2E smoke (Playwright) — ver [TESTING.md](./TESTING.md)
- [x] E2E ampliado (auth, atender ahora, booking, recetas wizard)
- [x] Monitoreo de errores (Sentry)
- [x] Listado/edición/borrado de reglas de disponibilidad
- [x] Mis turnos del portal backeados por servidor (WhatsApp offline en localStorage)

## Fase 2 — Integraciones reales

- [x] **2A Mercado Pago** — Checkout Pro, webhooks, suscripciones (migración 100)
- [x] **2B Email** — Resend/SMTP en recordatorios + invitaciones + notificaciones de turnos
- [x] **2C WhatsApp Business API** — Cloud API Meta + fallback wa.me (ver [WHATSAPP-INTEGRATION.md](./WHATSAPP-INTEGRATION.md))
- [x] **2D Telemedicina** — Jitsi embed, link paciente, email/WhatsApp, Daily.co opcional (migración 101)
- [x] **2E REFEPS / RENaPDiS** — adapter sandbox/API, firma digital (hash), panel config, envío manual/auto (migración 102) — ver [REFEPS-INTEGRATION.md](./REFEPS-INTEGRATION.md)

## Fase 3 — Compliance

- [x] Consentimiento informado digital — registro por consulta + PDF (Ley 26.529)
- [x] Exportación completa de datos (Habeas Data) — bundle JSON por paciente y por clínica
- [x] Retención y políticas de eliminación — política configurable, panel cumplimiento, baja lógica trazable
- [x] Logs de acceso a datos sensibles — `recordSensitiveAccess` en fichas/HC + panel Configuración

## Fase 4 — Producto avanzado

- [x] **4A Multi-sede avanzada** — CRUD sedes, filtros agenda, reglas por sede, wizard (ver [MULTI-SEDE.md](./MULTI-SEDE.md))
- [x] **4B Facturación y liquidación obras sociales** — tarifas OS, lotes desde atenciones, CSV, estados (ver [OS-LIQUIDACION.md](./OS-LIQUIDACION.md))
- [x] **4C API pública** — claves Bearer, `/api/v1` turnos/profesionales/disponibilidad (ver [PUBLIC-API.md](./PUBLIC-API.md))
- [x] **4D BI por especialidad / cobertura** — `/reportes/bi`, RPC `summarize_clinic_bi`, CSV (ver [BI-REPORTES.md](./BI-REPORTES.md))

## Deuda técnica conocida

| Item | Prioridad |
|------|-----------|
| Tipos generados desde Supabase CLI | Alta |
| Sync multi-dispositivo portal paciente | Alta |
| Upload adjuntos Storage | Alta |
| Paginación listados largos | Media |
| Tests E2E permisos cross-tenant | Alta |
