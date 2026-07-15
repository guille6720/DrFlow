# Roadmap — DrFlow

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

- [ ] CI/CD con GitHub Actions (lint, test, build)
- [ ] E2E con Playwright (auth, atender ahora, booking)
- [ ] Monitoreo de errores (Sentry)
- [ ] Listado/edición/borrado de reglas de disponibilidad
- [ ] Mis turnos del portal backeados por servidor (hoy: localStorage)

## Fase 2 — Integraciones reales

- [ ] **Mercado Pago** — Checkout Pro, webhooks
- [ ] **Email** — SendGrid/Resend (sacar “simulado”)
- [ ] **WhatsApp Business API** — envío automático (hoy: abrir chat)
- [ ] **Telemedicina** — embed propio o Daily.co
- [ ] **REFEPS / RENaPDiS** — homologación + firma digital

## Fase 3 — Compliance

- [ ] Consentimiento informado digital
- [ ] Exportación completa de datos (Habeas Data)
- [ ] Retención y políticas de eliminación
- [ ] Logs de acceso a datos sensibles

## Fase 4 — Producto avanzado

- [ ] Multi-sede avanzada
- [ ] Facturación y liquidación obras sociales
- [ ] API pública
- [ ] BI por especialidad / cobertura

## Deuda técnica conocida

| Item | Prioridad |
|------|-----------|
| Tipos generados desde Supabase CLI | Alta |
| Sync multi-dispositivo portal paciente | Alta |
| Upload adjuntos Storage | Alta |
| Paginación listados largos | Media |
| Tests E2E permisos cross-tenant | Alta |
