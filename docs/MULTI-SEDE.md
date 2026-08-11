# Multi-sede avanzada — Fase 4A

Gestión de **sedes** (`locations`) para consultorios con más de un consultorio físico o virtual.

## Modelo de datos

La tabla `locations` existe desde la migración inicial. Campos relevantes:

| Campo | Uso |
|-------|-----|
| `name` | Nombre visible (ej. "Sede Norte") |
| `address` | Dirección opcional |
| `phone` | Teléfono de la sede |
| `is_active` | Sede activa/inactiva (no se elimina automáticamente) |

Entidades que referencian sede:

- **Turnos** (`appointments.location_id`)
- **Profesionales** (`professionals.location_id` — sede habitual)
- **Reglas de disponibilidad** (`availability_rules.location_id`)

Reglas con `location_id` **null** aplican a **todas las sedes**.

## UI

### Configuración → Clínica

Panel **Sedes del consultorio**:

- Crear, editar (nombre, teléfono, dirección)
- Activar / desactivar
- Eliminar (los turnos históricos conservan la referencia)

Permiso: `manageSettings`.

### Agenda (`/turnos/agenda`)

Filtro por sede en la barra de herramientas. Al crear turno desde un slot, la sede seleccionada se pasa en la URL (`?location=...`).

### Configuración de agenda (`/turnos/configuracion`)

Al crear o editar reglas semanales, selector **Sede (opcional)**.

### Nuevo turno (`/turnos/nuevo`)

Selector **Consultorio** filtra los slots disponibles según las reglas de la sede elegida (más reglas globales).

## Lógica de filtrado

```typescript
// Reglas: null = todas las sedes; con sede = esa sede + globales
filterAvailabilityRulesByLocation(rules, locationId)

// Agenda: filtro combinado profesional / especialidad / sede
filterAgendaAppointments(appointments, filters)
```

Implementación: `src/core/booking/location-filters.ts`.

## Acciones server

| Acción | Archivo |
|--------|---------|
| `createLocation` | `src/lib/actions/settings.ts` |
| `updateLocation` | `src/lib/actions/settings.ts` |
| `setLocationActive` | `src/lib/actions/settings.ts` |
| `deleteLocation` | `src/lib/actions/settings.ts` |

Cache: `getCachedClinicLocations` → `loadClinicLocationsCached` (incluye `phone`, `is_active`).

## QA manual sugerido

1. **Configuración → Clínica** — crear dos sedes, editar teléfono, desactivar una
2. **Config. agenda** — regla solo para sede A; otra global; verificar slots en wizard
3. **Agenda** — filtrar por sede y confirmar que solo aparecen turnos de esa sede
4. **Nuevo turno** — cambiar consultorio y verificar recarga de horarios

## Tests

`tests/multi-sede.test.ts` — filtros de reglas/agenda y schemas Zod.

## Pendiente (futuro)

- Reportes y BI desglosados por sede (Fase 4D)
- Portal público con selector de sede al reservar
- Migración dedicada solo si se agregan columnas nuevas a `locations`
