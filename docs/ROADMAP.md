# Roadmap post-MVP — DrFlow

## Fase 1 — Estabilización (4-6 semanas)

- [ ] CI/CD con GitHub Actions (lint, test, build)
- [ ] E2E con Playwright (flujos críticos)
- [ ] Monitoreo de errores (Sentry)
- [ ] Completar CRUD en Configuración (especialidades, sedes, horarios)
- [ ] Reglas de disponibilidad en UI de agenda
- [ ] Bloqueos de horario desde agenda
- [ ] Reprogramación de turnos con historial
- [ ] Activar link público de solicitud de turno end-to-end

## Fase 2 — Integraciones reales (6-8 semanas)

- [ ] **Mercado Pago** — Checkout Pro, webhooks, estados reales
- [ ] **Email** — SendGrid/Resend para recordatorios transaccionales
- [ ] **WhatsApp** — Twilio o WhatsApp Business API
- [ ] **Telemedicina** — Jitsi embed propio o Daily.co
- [ ] Notificaciones in-app en tiempo real (Supabase Realtime)

## Fase 3 — Compliance médico (8-12 semanas)

- [ ] Consentimiento informado digital con firma
- [ ] Exportación completa de datos del paciente (GDPR/Habeas Data)
- [ ] Backup lógico automatizado
- [ ] Retención y políticas de eliminación
- [ ] Logs de acceso a datos sensibles
- [ ] Evaluación receta electrónica según jurisdicción

## Fase 4 — Producto avanzado (12+ semanas)

- [ ] Portal del paciente (turnos, historial limitado, pagos)
- [ ] Multi-sede avanzada con stock/inventario
- [ ] Facturación y obras sociales
- [ ] API pública para integradores
- [ ] App mobile (React Native o PWA)
- [ ] BI avanzado — dashboards por especialidad
- [ ] IA asistida — resumen de consultas (opt-in, auditado)

## Fase 5 — Escala SaaS

- [ ] Planes y billing (Stripe)
- [ ] Onboarding self-service mejorado
- [ ] White-label por clínica
- [ ] Multi-región / multi-idioma
- [ ] SLA y soporte enterprise

## Deuda técnica conocida MVP

| Item | Prioridad |
|------|-----------|
| Tipos generados desde Supabase CLI | Alta |
| Upload real de adjuntos (Storage) | Alta |
| Paginación en listados largos | Media |
| Optimistic updates en agenda | Media |
| Cache/revalidate granular | Media |
| Tests E2E permisos cross-tenant | Alta |
