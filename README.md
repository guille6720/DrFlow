# DrFlow

**DrFlow** es un MVP SaaS original para gestión de consultorios y clínicas médicas. Permite administrar turnos, pacientes, historias clínicas digitales, recordatorios, telemedicina base, pagos mock y reportes operativos.

> Identidad visual, marca y textos propios — no copia de sistemas existentes.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS 4 |
| Backend | Server Actions + API Routes |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Seguridad | Row Level Security, roles, validación server-side |

## Estructura de carpetas

```
DrFlow/
├── supabase/migrations/     # SQL: schema, RLS, seed
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, registro
│   │   ├── (dashboard)/     # Módulos autenticados
│   │   ├── solicitar-turno/ # Link público
│   │   └── api/             # API routes
│   ├── components/
│   │   ├── ui/              # Design system base
│   │   ├── layout/          # Sidebar, header
│   │   └── [modulo]/        # Vistas por módulo
│   ├── lib/
│   │   ├── supabase/        # Clientes SSR/CSR
│   │   ├── auth/            # Sesión y clínica activa
│   │   ├── permissions/     # Roles y permisos
│   │   ├── validations/     # Schemas Zod
│   │   ├── services/        # Mock: pagos, reminders, telemedicina
│   │   └── actions/         # Server actions
│   └── types/               # Tipos TypeScript
├── tests/                   # Vitest
└── docs/                    # QA checklist, roadmap
```

## Instalación

### 1. Clonar e instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com)
2. Copiá `.env.example` a `.env.local` y completá las variables:

```bash
cp .env.example .env.local
```

3. Ejecutá las migraciones en el SQL Editor de Supabase **en orden**:

```
supabase/migrations/001_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_seed.sql
supabase/migrations/004_demo_professionals_and_public_booking.sql
```

> Guía detallada paso a paso: **[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)**

4. (Opcional) Creá un bucket `clinical-files` en Storage para adjuntos futuros.

### 3. Crear usuario superadmin (desarrollo)

Después de registrarte vía `/register`, ejecutá en SQL:

```sql
UPDATE profiles SET is_superadmin = true WHERE email = 'tu@email.com';
```

### 4. Vincular usuarios demo a clínica seed

```sql
INSERT INTO clinic_members (clinic_id, user_id, role)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'TU_USER_UUID',
  'clinic_admin'
);
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000)

### 6. Tests

```bash
npm test
```

## Roles

| Rol | Descripción |
|-----|-------------|
| `superadmin` | Acceso SaaS global |
| `clinic_admin` | Administrador de clínica |
| `doctor` | Médico — historias clínicas |
| `secretary` | Recepción — turnos y pacientes |
| `patient` | Paciente — portal limitado |

## Módulos MVP

- **Auth & onboarding** — Login, registro de clínica, selector multi-clínica
- **Dashboard** — KPIs operativos y accesos rápidos
- **Agenda** — Vistas día/semana/mes, estados, filtros, anti-superposición
- **Pacientes** — CRUD completo con historial
- **Historia clínica** — Consultas, auditoría, PDF, borrador prescripción (sin validez legal)
- **Recordatorios** — Mock email/WhatsApp con logs
- **Telemedicina** — Salas Jitsi simuladas
- **Pagos** — Mock Mercado Pago
- **Reportes** — Métricas + export CSV
- **Configuración** — Datos de clínica, especialidades, roles

## Integraciones (preparadas, no activas)

Los servicios en `src/lib/services/` están diseñados para reemplazo:

- `payments.ts` → Mercado Pago SDK
- `reminders.ts` → SendGrid + Twilio/WhatsApp Business
- `telemedicine.ts` → Jitsi embed / Google Meet API

## Seguridad

- RLS en todas las tablas tenant-scoped
- Separación estricta por `clinic_id`
- Funciones helper: `user_clinic_ids()`, `can_view_clinical()`, etc.
- Auditoría en `audit_logs` y `clinical_record_audit`
- Sanitización de inputs en server actions

## Documentación adicional

- [Checklist QA](docs/QA_CHECKLIST.md)
- [Roadmap post-MVP](docs/ROADMAP.md)

## Licencia

Proyecto privado — DrFlow MVP.
