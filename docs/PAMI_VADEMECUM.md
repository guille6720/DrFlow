# Vademécum PAMI (Alfabeta / Gavade)

Importación del Excel de productos PAMI con precios y cobertura.

## Archivos

- `data/pami/gavade_20230829_102140.xlsx` — fuente original (8711 productos)
- `supabase/migrations/042_pami_vademecum.sql` — tabla + búsqueda
- `supabase/seeds/pami_vademecum_data.sql` — datos generados
- `scripts/import-pami-vademecum.mjs` — parser e importador

## Cargar en Supabase (producción)

```powershell
$env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"

# 1. Migración (solo la 042 si el resto ya está aplicado)
npx supabase db query --db-url $env:DATABASE_URL -f supabase/migrations/042_pami_vademecum.sql

# 2. Datos
npm run import:pami-vademecum -- --apply
```

Alternativa: pegar `supabase/seeds/pami_vademecum_data.sql` en el SQL Editor de Supabase.

## Regenerar SQL desde otro Excel

```powershell
npm run import:pami-vademecum -- "C:\ruta\archivo.xlsx" --sql-out supabase/seeds/pami_vademecum_data.sql
```

## UI

En **Herramientas → Guía farmacológica → Vademécum PAMI** se busca por marca, principio activo, laboratorio o código Alfabeta.
