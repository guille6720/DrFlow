# REFEPS / RENaPDiS — Fase 2E

Integración **adapter** para receta electrónica nacional. No sustituye la homologación MSN ni credenciales oficiales del Ministerio de Salud.

## Modos

| Modo | Condición | Comportamiento |
|------|-----------|----------------|
| **Sandbox** | Sin `REFEPS_API_URL` + `REFEPS_API_KEY` | Genera `REFEPS-SBX-{suffix}` local, payload JSON y hash SHA-256 |
| **API** | Variables configuradas en Vercel | POST a `{REFEPS_API_URL}/prescriptions` con Bearer token |

## Configuración por clínica

En **Configuración → Coberturas → REFEPS / RENaPDiS**:

- `refeps_enabled` — habilita trazabilidad REFEPS (status `pending_refeps` al emitir)
- `refeps_establishment_code` — código MSN del establecimiento
- `refeps_auto_submit` — envío automático al emitir (si no, envío manual desde la receta)

## Flujo de emisión

1. Usuario emite receta (motor Ley 25.649 + disclaimer local)
2. Si REFEPS habilitado → `refeps_status = pending_refeps`
3. Si auto-submit → `submitIssuedPrescriptionToRefeps()`
4. Éxito → `submitted` + `refeps_id` + `digital_signature_hash` + evento `refeps_submitted`
5. Error → `failed` + `refeps_error` + evento `refeps_failed`

## Firma digital (preparación)

El payload canónico se serializa con claves ordenadas (`stableStringify`) y se hashea con SHA-256 antes del envío. El hash se persiste en `prescription_drafts.digital_signature_hash`.

## Migración

- Desarrollo: `supabase/migrations/102_refeps_integration.sql`
- Producción: `supabase/scripts/prod-fix-refeps-integration.sql`

## Variables de entorno

```env
REFEPS_API_URL=https://api.refeps.example.gov.ar/v1
REFEPS_API_KEY=...
```

Sin estas variables el sistema opera en sandbox de forma explícita (UI + docs).

## Limitaciones

- Homologación MSN y contrato con REFEPS/RENaPDiS son responsabilidad del consultorio
- El QR REFEPS en PDF/vista previa codifica el identificador registrado; la validación en farmacia depende del servicio nacional
- Recetas emitidas antes de habilitar REFEPS conservan `refeps_status = local`
