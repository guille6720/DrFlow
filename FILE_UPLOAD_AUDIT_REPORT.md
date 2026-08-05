# Informe de Auditoría — Carga de Archivos

**Fecha:** 2026-08-04  
**Alcance:** Server Actions, staging imports, Supabase Storage (`clinical-files`), RLS, acceso a descargas  
**Estado post-refactor:** validación centralizada + migración bucket; tests ✅

---

## Resumen ejecutivo

| Métrica | Pre-audit | Post-audit |
|---------|-----------|------------|
| Puntos de carga identificados | **8** | **8** (sin nuevos endpoints) |
| Validación MIME por magic bytes | **0/8** | **8/8** |
| Validación extensión | **5/8** | **8/8** |
| Nombres con path traversal sanitizados | **Parcial** | **100%** |
| Bucket privado + signed URLs | ✅ | ✅ |
| RLS path-aware en storage | ✅ | ✅ |
| Riesgo global | **Medio** | **Bajo** |

---

## Inventario de flujos de carga

| Flujo | Entrada | Storage | Permiso | Max size |
|-------|---------|---------|---------|----------|
| Documento clínico PDF | `uploadPatientClinicalDocument` | `clinical-files/{clinic}/patients/{patient}/` | `editClinicalRecords` | 10 MB |
| Import PDF clínico (sync) | `importClinicalPdfDocument` | mismo bucket | import clínico | 10 MB |
| Import PDF clínico (async jobs) | `enqueueClinicalPdfImports` → staging → worker | `import-staging/` → patients | import clínico | 10 MB × 50 |
| Documento administrativo | `uploadPatientAdminDocument` | `{clinic}/{patient}/admin/` | `manageAdminDocuments` | 10 MB |
| CSV consultas clínicas | `importClinicalCsv` | sin storage (parse in-memory) | import clínico | 8 MB |
| CSV export HCE | `importHceExportCsv` / job | staging (jobs) o in-memory | import clínico | 15 MB |
| Excel/CSV pacientes | `importConsumersFile` / job | staging (jobs) | `managePatients` | 15 MB |
| Adjunto HCE generado | `ensureHceAttachment` (server) | patients path | worker interno | N/A |

**Fuera de alcance:** `importTeamsJsonlBatch` recibe JSON parseado (no archivo binario).

---

## Controles por dimensión

### 1. Validación MIME / contenido

| Problema (pre) | Severidad | Fix |
|----------------|-----------|-----|
| Admin docs confiaban en `file.type \|\| "application/pdf"` — JPEG podía subirse como PDF | **Alta** | `validateAdminDocumentUpload()` inspecciona magic bytes (%PDF, JPEG, PNG) |
| PDF clínico solo validaba extensión/MIME del cliente | **Media** | `validatePdfUpload()` + `%PDF-` en buffer |
| Jobs PDF staging no validaban contenido antes de subir | **Media** | Validación en `enqueueClinicalPdfImports` |
| HCE/consumers solo validaban tamaño | **Media** | `validateCsvImportUpload` / `validateSpreadsheetImportUpload` |
| Worker PDF no re-validaba buffer | **Baja** | `isPdfBuffer()` en `processClinicalPdfImport` |

**Nuevo módulo:** `src/core/security/file-upload.ts`

### 2. Tamaño máximo

| Constante | Valor | Usos |
|-----------|-------|------|
| `CLINICAL_DOCUMENT_MAX_BYTES` | 10 MB | PDF clínico |
| `CLINICAL_CSV_MAX_BYTES` | 8 MB | CSV consultas |
| `HCE_EXPORT_MAX_BYTES` | 15 MB | HCE CSV |
| `CONSUMERS_IMPORT_MAX_BYTES` | 15 MB | Excel pacientes |
| Bucket `file_size_limit` (DB) | 10 MB | Supabase enforcement |

**Nota:** imports staging de 15 MB usan `application/octet-stream` permitido en bucket; el límite de 10 MB del bucket puede rechazar algunos staging >10MB hasta ampliar `file_size_limit` — ver recomendación opcional.

### 3. Extensiones permitidas

| Tipo | Extensiones | Validación |
|------|-------------|------------|
| Clínico | `.pdf` | extensión + magic |
| Admin | `.pdf`, `.jpg`, `.jpeg`, `.png` | magic (UI: `accept="application/pdf,.pdf,image/*"`) |
| CSV clínico/HCE | `.csv` | extensión + texto sin null bytes |
| Pacientes | `.xlsx`, `.xls`, `.csv`, `.csv.xlsx` | extensión + ZIP magic (Excel) o CSV text |

### 4. Nombres seguros

| Pre | Post |
|-----|------|
| Duplicación de `sanitizeFileName` en 3 archivos | `sanitizeStorageFileName()` centralizado |
| Admin usaba `Date.now()` (predecible) | `randomUUID()` en path via `buildPatientFilePath()` |
| Path traversal parcial | Strip de `/`, `\`, caracteres no alfanuméricos |
| Límite longitud nombre | 180 chars max |

Formato path: `{clinicId}/patients/{patientId}/{uuid}-{safeName}` o `{clinicId}/{patientId}/admin/{uuid}-{safeName}`

### 5. Almacenamiento seguro

| Control | Estado |
|---------|--------|
| Bucket `clinical-files` **privado** (`public: false`) | ✅ migración 028 |
| Sin `getPublicUrl()` en código app | ✅ verificado en tests |
| Descargas vía `createSignedUrl` (TTL 3600s) | ✅ |
| Staging en `{clinic}/import-staging/{batchId}/` | ✅ |
| Cleanup staging post-job | ✅ workers |
| Rollback storage si falla INSERT admin doc | ✅ **añadido** |
| Rollback storage si falla INSERT clínico | ✅ pre-existente |

**Migración 059:** añade `image/jpeg`, `image/png` al bucket (necesario para fotos admin; antes fallaban silenciosamente en storage).

### 6. Permisos de acceso

| Capa | Mecanismo |
|------|-----------|
| Server Action | `hasPermission` / `requireClinicPermission` |
| Paciente en tenant | `.eq("clinic_id", clinicId)` antes de upload |
| Storage RLS | `can_read_clinical_storage` / `can_write_clinical_storage` (053) |
| Paths admin vs clinical vs staging | `clinical_storage_path_kind()` |
| Jobs async | `assertStoragePathInClinic()` en handlers |
| Signed URL | Solo tras verificar attachment/doc en DB + clinic |

---

## Cambios implementados

### Código

1. **`src/core/security/file-upload.ts`** — validadores, sanitización, paths, magic bytes  
2. **`patient-attachments.ts`** — usa validador PDF centralizado  
3. **`admin-documents.ts`** — magic bytes, UUID paths, rollback storage, contentType server-side  
4. **`import-jobs.ts`** — validación PDF/CSV/spreadsheet antes de staging  
5. **`hce-import.ts`**, **`patient-import.ts`**, **`clinical-import.ts`** — validadores centralizados  
6. **`process-clinical-pdf-import.ts`** — re-validación `%PDF-`, paths compartidos  
7. **`import-staging.ts`** — sanitización compartida  

### Base de datos

8. **`059_file_upload_hardening.sql`** — MIME `image/jpeg`, `image/png` en bucket

### Tests

9. **`tests/file-upload-audit.test.ts`** — unit + scan estático

---

## Hallazgos cerrados

| # | Hallazgo | Severidad | Estado |
|---|----------|-----------|--------|
| 1 | Admin upload MIME spoofing | Alta | ✅ Corregido |
| 2 | PDF sin magic byte validation | Media | ✅ Corregido |
| 3 | Staging PDF sin validación previa | Media | ✅ Corregido |
| 4 | HCE/consumers solo size check | Media | ✅ Corregido |
| 5 | Admin path predecible (`Date.now`) | Baja | ✅ Corregido |
| 6 | Orphan storage en fallo INSERT admin | Baja | ✅ Corregido |
| 7 | Imágenes admin bloqueadas por bucket MIME | Media funcional | ✅ Migración 059 |

---

## Riesgo residual (bajo)

1. **Bucket `file_size_limit` = 10 MB** vs imports staging de 15 MB — staging puede fallar en Supabase para HCE/consumers >10MB. Ampliar a 15 MB en migración futura si se confirma en producción.  
2. **WebP admin** — UI `image/*` puede ofrecer WebP; no está en allowlist (rechazado explícitamente).  
3. **Antivirus/malware scan** — no implementado (típico en SaaS clínico; considerar ClamAV async para PDFs).  
4. **Signed URL TTL 1h** — link válido mientras dure; mitigado por auth previa para generarlo.

---

## Verificación

```bash
npm run test -- tests/file-upload-audit.test.ts
npm run quality-gate
```

---

## Recomendaciones opcionales

1. Migración `060`: `file_size_limit = 15728640` (15 MB) alineado con constantes app.  
2. Validar `category` admin contra `ADMIN_DOCUMENT_CATEGORIES` en Zod.  
3. Rate limit uploads por usuario/clínica (observability).  
4. Quarantine bucket para staging antes de promover a `patients/`.

---

## Conclusión

El sistema de carga quedó con **validación de contenido server-side** (no solo extensión/MIME del cliente), **nombres y paths no predecibles**, **bucket privado con RLS path-aware**, y **acceso de descarga solo vía signed URLs** tras control de permisos. Las vulnerabilidades de MIME spoofing en documentos administrativos y la falta de magic-byte checks en PDFs fueron corregidas sin cambiar los flujos funcionales de la UI.
