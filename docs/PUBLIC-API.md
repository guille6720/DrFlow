# API pública — Fase 4C

API REST **machine-to-machine** para integraciones externas (ERP, bots, kioscos). Autenticación con claves Bearer por clínica — **no** expone la anon key de Supabase.

## Autenticación

```
Authorization: Bearer dfk_live_<secret>
```

Las claves se generan en **Configuración → Sistema → API pública**. El secret completo se muestra **una sola vez** al crear.

## Scopes

| Scope | Permiso |
|-------|---------|
| `appointments:read` | Listar turnos, detalle, disponibilidad |
| `appointments:write` | Crear turnos (estado `pending`) |
| `professionals:read` | Listar profesionales activos |

## Endpoints v1

Base: `https://drflow.opusorg.com/api/v1`

| Método | Ruta | Scope |
|--------|------|-------|
| GET | `/appointments` | read |
| GET | `/appointments/:id` | read |
| POST | `/appointments` | write |
| GET | `/professionals` | read |
| GET | `/availability?professional_id=…` | read |

### Respuesta

```json
{
  "data": [ ... ],
  "meta": { "clinic_id": "…", "trace_id": "…" }
}
```

Errores: `{ "error": "…", "meta": { "trace_id": "…" } }`

### Crear turno (POST /appointments)

```json
{
  "professional_id": "uuid",
  "start_at": "2026-08-15T14:00:00.000Z",
  "first_name": "Juan",
  "last_name": "Pérez",
  "document_number": "12345678",
  "phone": "01112345678",
  "email": "opcional@mail.com",
  "reason": "Consulta"
}
```

`booking_source` = `api`. Misma lógica de conflicto de horarios que reserva online.

### Listar turnos (GET /appointments)

Query params: `from`, `to`, `professional_id`, `status`, `limit` (max 500).

Campos expuestos **sin PHI completa**: nombre paciente, últimos 4 dígitos DNI, sin notas clínicas.

## Límites

- **120 req/min** por clave (in-memory en el servidor)
- Plugin `public_api` debe estar habilitado (se activa al crear la primera clave)

## Migración

- Desarrollo: `supabase/migrations/104_clinic_api_keys.sql`
- Producción: `supabase/scripts/prod-fix-clinic-api-keys.sql` + migration completa

## QA manual

1. Configuración → API pública → generar clave con scopes read+write
2. `curl -H "Authorization: Bearer dfk_live_…" https://drflow.opusorg.com/api/v1/professionals`
3. GET availability → POST appointment → GET by id

## Pendiente (futuro)

- Webhooks outbound (turno confirmado/cancelado)
- OAuth2 / rotación automática de claves
- Patient search con audit estricto
- OpenAPI spec publicada
