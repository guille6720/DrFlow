# Vademécum PAMI (Alfabeta / Gavade)

Importación del Excel de productos PAMI con precios y cobertura.

## Archivos

- `data/pami/gavade_20230829_102140.xlsx` — fuente original (8711 productos)
- `supabase/migrations/042_pami_vademecum.sql` — tabla + búsqueda
- `scripts/import-pami-vademecum.mjs` — parser e importador

## Cargar en Supabase

**No pegues** `pami_vademecum_data.sql` completo en SQL Editor: Supabase lo rechaza por tamaño.

### Opción A — Conexión directa (recomendada)

```powershell
$env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"

# Tabla (solo una vez)
npx supabase db query --db-url $env:DATABASE_URL -f supabase/migrations/042_pami_vademecum.sql

# Datos en lotes de 50 filas
npm run import:pami-vademecum -- --apply
```

### Opción B — Service role (sin DATABASE_URL)

Agregá `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (Settings → API en Supabase), luego:

```powershell
npm run import:pami-vademecum -- --apply-api
```

### Opción C — SQL Editor (lotes chicos)

```powershell
npm run import:pami-vademecum -- --split-dir supabase/seeds/pami_batches
```

Ejecutá `042_pami_vademecum.sql` y después cada `pami_vademecum_001.sql`, `002.sql`, … (~109 archivos).

## UI

**Herramientas → Guía farmacológica → Vademécum PAMI**
