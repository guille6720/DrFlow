# Anexo de Seguridad — DrFlow

> **BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL**

## 1. Arquitectura

- Aplicación Next.js desplegada en Vercel
- Base de datos PostgreSQL en Supabase con Row Level Security (RLS)
- Almacenamiento de archivos clínicos en bucket privado Supabase
- Multi-tenancy por `clinic_id`

## 2. Controles de acceso

- Autenticación vía Supabase Auth (email, MFA TOTP opcional)
- Autorización por roles y permisos granulares
- RLS como última línea de defensa en base de datos
- Service role key solo server-side, nunca expuesta al cliente

## 3. Cifrado

- En tránsito: TLS/HTTPS (HSTS habilitado)
- En reposo: cifrado gestionado por Supabase — REQUIERE VERIFICACIÓN de configuración

## 4. Auditoría

- Tablas `audit_logs` y `clinical_record_audit` inmutables (triggers anti-mutación)
- Registro de accesos sensibles, exportaciones, cambios de permisos
- Auditoría de uso de IA sin almacenar prompts

## 5. Gestión de incidentes

REQUIERE VERIFICACIÓN — procedimiento documentado de respuesta a incidentes y notificación al responsable/cliente.

## 6. Copias de seguridad

Backups gestionados por Supabase. Procedimiento de restauración: `docs/DISASTER_RECOVERY.md`.

## 7. Desarrollo seguro

- Validación de entrada (Zod)
- CSRF en mutaciones
- CSP y headers de seguridad
- Sanitización de IA antes de envío a proveedores externos
- Tests de RLS y tenant isolation

## 8. Eliminación de datos

- Pacientes: soft-delete con retención de HC
- Historias clínicas: inmutables, no se eliminan
- Cuenta de usuario: limpieza de referencias preservando auditoría

---

*Versión borrador: 2026-08-24. **BORRADOR — REQUIERE REVISIÓN DE ABOGADO EN ARGENTINA ANTES DE SU USO COMERCIAL**. No es asesoramiento legal final.*
