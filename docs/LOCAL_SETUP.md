# Probar DrFlow en local — guía rápida

Seguí estos pasos en orden. Toma ~15 minutos la primera vez.

---

## 1. Requisitos

- Node.js 20+
- Cuenta gratis en [supabase.com](https://supabase.com)

---

## 2. Instalar dependencias

```bash
cd DrFlow
npm install
```

---

## 3. Crear proyecto Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Elegí nombre, contraseña de DB y región
3. Esperá a que el proyecto esté listo (~2 min)

---

## 4. Variables de entorno

Copiá `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

En Supabase → **Project Settings → API**, copiá:

| Variable | Dónde encontrarla |
|----------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (opcional para reserva pública vía RPC no es obligatorio) |

Tu `.env.local` debe verse así:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

> **Importante:** Desactivá “Confirm email” para probar más rápido:  
> **Authentication → Providers → Email → desmarcar “Confirm email”**

---

## 5. Ejecutar migraciones SQL

En Supabase → **SQL Editor**, ejecutá **en este orden** (copiar/pegar cada archivo completo):

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_seed.sql`
4. `supabase/migrations/004_demo_professionals_and_public_booking.sql`
5. `supabase/migrations/005_pharmacology_reference.sql`

Cada una debe terminar con **Success**.

---

## 6. Levantar la app

```bash
npm run dev
```

Abrí: **http://localhost:3000**

---

## 7. Crear tu usuario admin

1. Andá a **http://localhost:3000/register**
2. Registrá una clínica (ej: “Mi Clínica Demo”, slug `mi-clinica-demo`)
3. Te redirige al dashboard

**Opción A — Usar datos demo precargados**

En SQL Editor, vinculá tu usuario a la clínica demo:

```sql
-- Reemplazá el email por el tuyo
INSERT INTO clinic_members (clinic_id, user_id, role)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  id,
  'clinic_admin'
FROM profiles
WHERE email = 'tu@email.com'
ON CONFLICT (clinic_id, user_id) DO UPDATE SET role = 'clinic_admin';
```

Recargá el dashboard y elegí **Centro Médico Norte** en el selector de clínica (si aparece).

**Opción B — Solo tu clínica nueva**

Agregá profesionales manualmente en Configuración o ejecutá SQL adaptado.

---

## 8. Qué probar

### Panel interno (logueado)

| URL | Qué ver |
|-----|---------|
| http://localhost:3000/dashboard | KPIs y turnos de hoy |
| http://localhost:3000/agenda | 3 profesionales demo + turnos |
| http://localhost:3000/pacientes | María, Carlos, Lucía |
| http://localhost:3000/historias | Historias clínicas |
| http://localhost:3000/reportes | Métricas del mes |

### Reserva pública (sin login)

**http://localhost:3000/solicitar-turno/centro-medico-norte-turnos**

1. Elegí un profesional (Dra. Ana Martínez, Dr. Pablo Ribera, etc.)
2. Elegí un horario libre
3. Completá tus datos y enviá
4. Volvé a **Agenda** logueado → el turno aparece como **Pendiente**

---

## 9. Profesionales demo incluidos

| Profesional | Especialidad | Sede |
|-------------|--------------|------|
| Dra. Ana Martínez | Clínica Médica | Sede Principal |
| Dr. Pablo Ribera | Pediatría | Sede Principal |
| Dra. Laura Soto | Cardiología | Sede Norte |

Horarios: Lun–Vie 9:00–17:00, turnos de 30 min.

---

## 10. Tests automatizados

```bash
npm test
```

---

## Problemas frecuentes

### “Invalid API key” / errores de auth
- Verificá que `.env.local` tenga las 3 variables correctas
- Reiniciá `npm run dev` después de cambiar `.env.local`

### Dashboard vacío / sin clínica
- Ejecutá el SQL del paso 7 para vincular tu usuario a la clínica demo
- O registrá una clínica nueva en `/register`

### Link público: “No hay profesionales”
- Ejecutá la migración `004_demo_professionals_and_public_booking.sql`

### Link público: 404
- Usá el slug exacto: `centro-medico-norte-turnos`
- Verificá en SQL: `SELECT * FROM public_booking_links;`

### Turno público no aparece en agenda
- Asegurate de estar viendo la clínica **Centro Médico Norte** (no otra)
- El turno queda en estado **pending**

---

## Comandos útiles

```bash
npm run dev      # Desarrollo
npm run build    # Build producción
npm test         # Tests
npm run lint     # ESLint
```
