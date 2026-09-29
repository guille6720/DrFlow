# REFEPS — validación profesional (histórico Fase 2E)

> **Actualización (0.2.19):** REFEPS se usa **solo para validar profesionales**. El registro de la receta
> y el CUIR corresponden a un **repositorio ReNaPDiS homologado** externo. La arquitectura vigente está
> en [`RENAPDIS-INTEGRATION-ARCHITECTURE.md`](./RENAPDIS-INTEGRATION-ARCHITECTURE.md).

## Qué cambió

- Se eliminó el adapter legacy que hacía `POST {REFEPS_API_URL}/prescriptions` (endpoint no oficial, nunca
  documentado por el Ministerio) y que generaba identificadores `REFEPS-SBX-*` al emitir.
- Los registros históricos con `refeps_status = submitted` y `refeps_id = REFEPS-SBX-*` se conservan y se
  muestran como **"Adapter legacy (sin validez oficial)"**. No son CUIR ni registros nacionales.
- `submitPrescriptionToRefeps` (server action) quedó como wrapper deprecado que delega en el flujo nacional
  (`submitNationalPrescriptionForSession`), que respeta feature flag, plan, RBAC, MFA y validación REFEPS.

## Configuración por clínica (sin cambios de esquema)

En **Configuración → Coberturas → Receta electrónica nacional**:

- `refeps_enabled` — marca la receta como pendiente de envío nacional (`pending_refeps`) al emitir.
- `refeps_establishment_code` — código de establecimiento (requerido por el flujo nacional).
- `refeps_auto_submit` — intenta el envío nacional al emitir **solo si** la funcionalidad
  `national_electronic_prescription` está habilitada para la clínica y la integración está lista.

## Variables de entorno (server-only, sin valores en el repo)

```env
REFEPS_VALIDATION_API_URL=
REFEPS_VALIDATION_API_KEY=
REFEPS_VALIDATION_MODE=
# Legacy aceptadas como fallback:
REFEPS_API_URL=
REFEPS_API_KEY=
```

Aunque existan URL y clave, la validación oficial permanece **no disponible** hasta implementar un cliente
contra el contrato oficial documentado de REFEPS. Nunca se valida a un profesional en silencio.

## Migraciones

- `supabase/migrations/102_refeps_integration.sql` (no se modifica).
- `supabase/migrations/20260929120000_national_eprescription_repository.sql` (columnas del ciclo nacional/CUIR).
