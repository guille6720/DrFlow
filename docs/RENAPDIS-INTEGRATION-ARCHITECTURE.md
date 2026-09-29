# Receta electrónica nacional — arquitectura de integración ReNaPDiS / CUIR

Estado: **preparado para integración ReNaPDiS**. NexClinic **no** está homologado ante ReNaPDiS ni ante
ningún repositorio, y **no** emite recetas electrónicas nacionales válidas para dispensa.

Official ReNaPDiS repository credentials and Ministry/provider homologation are external requirements and are not created by NexClinic.

## 1. Separación de responsabilidades

| Pieza | Responsabilidad | Código |
|-------|-----------------|--------|
| REFEPS | Validar al profesional (matrícula/estado). **No** registra recetas. | `src/core/refeps/professional-validation.ts` |
| Repositorio ReNaPDiS | Registrar la receta y devolver el **CUIR**. Proveedor externo homologado. | `src/core/renapdis/repository/*`, `src/core/renapdis/providers/*` |
| Orquestador | Gates, idempotencia, máquina de estados, reintentos, auditoría. | `src/core/renapdis/national-prescription/orchestrator.ts` |
| Adaptador Supabase | Persistencia (CAS), carga de datos por clínica, sesión. | `src/core/renapdis/national-prescription/national-prescription.server.ts` |
| Server actions | Entrada desde UI, ids validados, resultados sin secretos. | `src/lib/actions/national-prescription.ts` |

La receta **local** (Ley 25.649) no cambia: se emite, imprime y comparte igual que antes.

## 2. Capa de repositorio (agnóstica de proveedor)

Interfaz `PrescriptionRepositoryProvider`:

- `submitPrescription(request, ctx)`
- `getPrescriptionStatus(ref, ctx)`
- `verifyCuir(cuir, ctx)`
- `cancelPrescription(ref, reason, ctx)`

`ctx = { idempotencyKey, correlationId, timeoutMs }`.

Proveedores:

- **not-configured** (`providers/not-configured.ts`): toda operación falla cerrada (`not_configured`,
  `unknown_provider`, `missing_credentials`).
- **sandbox** (`providers/sandbox.ts`): sin red; devuelve `sandboxReference = SBX-RNPD-<hash>` determinístico
  por clave de idempotencia. **Nunca** devuelve `cuir`. Bloqueado cuando `VERCEL_ENV=production`.
- **external** (`providers/external.ts`): transporte genérico (fetch con timeout, `no-store`) que recibe un
  `ExternalRepositoryAdapter` (armado/parseo por operación) y un proveedor de credenciales.
  **No hay adaptadores concretos registrados** (`EXTERNAL_REPOSITORY_PROVIDER_IDS` vacío): no se inventaron
  endpoints, formatos ni respuestas oficiales.

Selección: `resolveRepositoryConfig()` + `resolveRepositoryProvider()` según `RENAPDIS_REPOSITORY_PROVIDER`.
Proveedor desconocido o sin credenciales ⇒ falla cerrada.

### Cómo agregar un proveedor real (cuando exista documentación oficial)

1. Obtener documentación de API, homologación y credenciales del repositorio elegido.
2. Crear `src/core/renapdis/providers/<proveedor>.ts` implementando `ExternalRepositoryAdapter`.
3. Registrar el id en `EXTERNAL_REPOSITORY_PROVIDER_IDS` y en `resolveRepositoryProvider`.
4. Tests contra respuestas grabadas del sandbox oficial del proveedor.
5. Configurar variables en el entorno (nunca en el repo) y `RENAPDIS_HOMOLOGATION_CONFIRMED=true` solo tras la homologación.

## 3. DTOs normalizados

`repository-types.ts`: `NationalPrescriptionRequest`, `NationalPrescriptionResponse` (unión discriminada:
external → `cuir | null`; sandbox → `sandboxReference`), `CuirStatusResponse`, `CuirVerificationResponse`,
`CancelPrescriptionResponse`, `ProviderError`. `assertValidProviderResponse` rechaza sandbox con CUIR y CUIR
externos que no cumplan el formato Anexo IV (numérico, 17–41 dígitos).

## 4. Máquina de estados (`national-state-machine.ts`, espejada en SQL)

```
issued_local → professional_validation_pending | cancelled
professional_validation_pending → professional_validated | professional_validation_failed
professional_validated → repository_submission_pending | professional_validation_pending (recuperación) | cancelled
repository_submission_pending → repository_submitted | cuir_assigned | repository_submission_failed | repository_unavailable
repository_submitted → cuir_assigned | cuir_verification_failed | cancelled
cuir_assigned ⇄ cuir_verification_failed; ambos → cancelled
(professional_validation_failed | repository_submission_failed | repository_unavailable) → professional_validation_pending (reintento) | cancelled
cancelled = terminal
```

`cuir_assigned` exige modo `external` **y** CUIR oficial válido. En sandbox es inalcanzable.

## 5. Ciclo de vida del CUIR

- NexClinic **nunca** genera un CUIR.
- `cuir` solo se escribe con la respuesta de un repositorio externo y tras validar formato.
- `sandbox_reference` es una columna separada; las constraints impiden tener ambas a la vez.
- `cuir`, `sandbox_reference` e `idempotency_key` son inmutables una vez escritos (trigger).
- La UI muestra "Referencia de prueba" + banner **"SANDBOX / TEST — NOT VALID FOR DISPENSING"**; nunca la
  rotula como CUIR.

## 6. Feature flag y gates

`national_electronic_prescription` (registry de personalizaciones, `defaultEnabled: false`, crítica,
configurable por Superadmin por clínica). Orden de gates en el orquestador, **todos obligatorios**:

1. RBAC `issuePrescriptions`
2. Plan (`product.clinic`)
3. Feature flag
4. MFA AAL2 del prescriptor
5. Código de establecimiento
6. Configuración de repositorio (falla cerrada)
7. Validación REFEPS (inválido/no disponible ⇒ no se llama al repositorio). Un repositorio externo exige
   validación REFEPS **oficial** (no sandbox).

El flag nunca saltea billing, RBAC ni validación profesional.

## 7. Readiness (`national-readiness.ts`)

Devuelve entorno, flag, plan, establecimiento, modos REFEPS/repositorio, credenciales oficiales, CUIR oficial
disponible, homologación confirmada, `readyForNationalPrescription`, `readyForSandboxTesting` y bloqueantes.
Se muestra en Superadmin → Personalizaciones (por clínica) y Superadmin → ReNaPDiS Readiness (plataforma).

## 8. Seguridad

- Todo server-side; variables sin `NEXT_PUBLIC_`; secretos nunca serializados al cliente.
- `clinic_id` y `user_id` salen de la sesión; los ids del cliente se validan con `parseEntityId` y todas las
  consultas se filtran por clínica.
- Columnas nacionales escribibles **solo por `service_role`** (trigger `guard_national_rx_columns`); el
  navegador no puede inyectar CUIR ni estados.
- Logs estructurados sin PHI (solo ids, estado, códigos de error, correlation id).
- Timeouts por intento (2–60 s, default 15 s), reintentos con backoff exponencial + jitter solo para
  errores reintentables (timeout, 429, proveedor no disponible, 5xx).
- Taxonomía de errores tipada (`repository-errors.ts`) con mensajes de usuario fijos (sin detalles del proveedor).

## 9. Idempotencia y concurrencia

- Clave estable `nrx:{clinicId}:{prescriptionId}:{submissionId}` enviada al proveedor; índice único por clínica.
- Claim atómico con compare-and-set sobre `national_rx_updated_at`: un solo proceso gana; el resto recibe
  `in_progress`. Recetas ya registradas ⇒ `already_registered` sin llamar al proveedor.
- Estados pendientes con más de 5 minutos se recuperan de forma segura.

## 10. Auditoría (sin PHI)

`refeps_validation_requested`, `refeps_validation_success`, `refeps_validation_failed`,
`repository_submission_requested`, `repository_submission_success`, `repository_submission_failed`,
`cuir_received`, `cuir_verified`, `cuir_verification_failed`, `national_prescription_blocked`,
`national_prescription_cancelled`.
Metadata: ids, estados, modos, códigos de error, correlation id. Nunca medicamentos, diagnósticos, DNI ni secretos.

## 11. Variables de entorno

Ver `.env.example` (solo placeholders): `REFEPS_VALIDATION_API_URL`, `REFEPS_VALIDATION_API_KEY`,
`REFEPS_VALIDATION_MODE`, `RENAPDIS_REPOSITORY_PROVIDER`, `RENAPDIS_REPOSITORY_API_URL`,
`RENAPDIS_REPOSITORY_AUTH_MODE`, `RENAPDIS_REPOSITORY_CLIENT_ID`, `RENAPDIS_REPOSITORY_CLIENT_SECRET`,
`RENAPDIS_REPOSITORY_TOKEN_URL`, `RENAPDIS_REPOSITORY_JWT_PRIVATE_KEY`, `RENAPDIS_REPOSITORY_MTLS_CERT`,
`RENAPDIS_REPOSITORY_MTLS_KEY`, `RENAPDIS_REPOSITORY_TIMEOUT_MS`, `RENAPDIS_HOMOLOGATION_CONFIRMED`.

## 12. Base de datos

Migración `20260929120000_national_eprescription_repository.sql` (rollback en
`supabase/migrations/rollback/`): columnas nullable en `prescription_drafts`, constraints de formato/exclusión,
índices únicos (idempotencia, submission, CUIR), funciones con `REVOKE` a `PUBLIC/anon/authenticated`,
trigger de protección y seed del feature flag (OFF).

## 13. Requisitos externos pendientes

- Elegir un repositorio ReNaPDiS homologado y firmar el acuerdo correspondiente.
- Documentación oficial de su API (registro, estado, verificación y anulación de recetas).
- Credenciales y entorno de homologación del proveedor.
- Contrato oficial de consulta REFEPS y sus credenciales.
- Homologación formal del software y del establecimiento ante el Ministerio / proveedor.
- Firma digital del profesional según normativa vigente.
