# Monitoreo de rendimiento — DrFlow

Sistema centralizado de observabilidad sobre `clinic_observability_events` (Phase 16). No introduce un stack paralelo ni bloquea requests en producción.

## Métricas

| Métrica | Categoría | Origen | Persistencia |
|---------|-----------|--------|--------------|
| Tiempo de respuesta API | `api` | `withObservabilityApiRoute` | Solo si ≥ 2 s (warn) o ≥ 4 s (error) |
| Consultas lentas | `query` | `observeQuery()` | Solo si ≥ 500 ms o error |
| Uso de memoria heap | `api` (`health_check`) | Cron `/api/health?persist=1` | Cada hora en metadata |
| Errores server | `error` | `logServerError()` | Siempre |
| Errores client | `error` | `logClientError()` → POST batch | Siempre (rate-limited) |
| Jobs | `job` | `process.ts` | Según duración |
| Web Vitals (LCP, INP, CLS, FCP, TTFB) | `performance` | `PerformanceMonitor` + `web-vitals` | Una vez por métrica/sesión |
| Tiempo de carga | `performance` (`page_load`) | Navigation Timing API | Por navegación |

## Umbrales

- **Query:** 500 ms (warn), 1000 ms (error)
- **API / performance:** 2000 ms (warn), 4000 ms (error)
- **Job:** 5000 ms (warn), 10000 ms (error)
- **Web Vitals:** umbrales Google en `web-vitals-thresholds.ts`

## Arquitectura

```
Cliente (dashboard)
  ├─ PerformanceMonitor → web-vitals + page_load
  └─ logClientError → client-reporter (batch, sendBeacon)
         ↓ POST /api/observability/events (auth staff)
Servidor
  ├─ withObservabilityApiRoute → API timing (solo lentas)
  ├─ observeQuery → loaders / Supabase (solo lentas)
  ├─ logServerError → errores + trace_id opcional
  └─ recordObservabilityEvent → clinic_observability_events (fire-and-forget)
         ↓
Configuración → Observabilidad (panel 24 h)
```

## Impacto en producción (mínimo)

1. **Fire-and-forget:** `void recordObservabilityEvent()` — nunca await en el hot path crítico del handler.
2. **Solo lentas:** API y queries persisten únicamente cuando superan umbral (`onlyIfSlow`).
3. **Cliente en prod:** `PerformanceMonitor` activo solo en `NODE_ENV=production` (o `NEXT_PUBLIC_OBSERVABILITY_CLIENT=1` para staging).
4. **Rate limit cliente:** máx. 30 eventos / 5 min, batches de 5, flush con `sendBeacon` al cerrar pestaña.
5. **Sin middleware DB:** el edge middleware no escribe a Supabase (evita cold starts y límites Edge).

## Uso

### Instrumentar una API

```typescript
import { withObservabilityApiRoute } from "@/core/observability/api-route";

export const GET = withObservabilityApiRoute("my_route", async (request, ctx) => {
  ctx.clinicId = await getActiveClinicId();
  // ...
  return NextResponse.json({ ok: true });
});
```

### Instrumentar una consulta

```typescript
import { observeQuery } from "@/core/observability/observe-query";

const rows = await observeQuery("load_patients", clinicId, async () => {
  const { data, error } = await supabase.from("patients").select("*").limit(50);
  if (error) throw error;
  return data ?? [];
}, "/pacientes");
```

### Trace ID

Middleware propaga `x-drflow-trace-id`. Pasar en errores server:

```typescript
import { getRequestTraceId } from "@/core/observability/request-trace";

const traceId = await getRequestTraceId();
logServerError("scope", err, { clinicId, traceId, path });
```

## Dashboard

**Configuración → Observabilidad:** errores, consultas/API lentas, p75 LCP, Web Vitals pobres, memoria heap (health en vivo), eventos recientes.

## Retención

Cron diario `GET /api/observability/purge` — 30 días (`purge_old_observability_events`).

## Variables opcionales

| Variable | Efecto |
|----------|--------|
| `NEXT_PUBLIC_OBSERVABILITY_CLIENT=1` | Habilita reporter cliente en dev |
| `NEXT_PUBLIC_OBSERVABILITY_CLIENT=0` | Desactiva reporter cliente |

## Archivos clave

- `src/core/observability/record.ts` — persistencia central
- `src/core/observability/api-route.ts` — wrapper API
- `src/core/observability/observe-query.ts` — wrapper queries
- `src/core/observability/client-reporter.ts` — ingest cliente
- `src/app/api/observability/events/route.ts` — endpoint batch
- `src/core/components/observability/performance-monitor.tsx` — Web Vitals
- `src/lib/server/load-observability.ts` — agregados 24 h
