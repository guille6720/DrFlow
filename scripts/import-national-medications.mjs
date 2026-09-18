/**
 * Importa catálogo nacional SIAFAR/COFA desde remedi.ar (datos abiertos derivados del PDF oficial).
 *
 * Uso:
 *   npm run import:national-medications -- --download
 *   npm run import:national-medications -- --file data/anmat/remediar-sample.json --split-dir supabase/seeds/national_batches
 *   npm run import:national-medications -- --file data/anmat/remediar-sample.json --apply
 */
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const DEFAULT_URL = "https://remedi.ar/data/medicamentos.json";
const DEFAULT_FILE = resolve(process.cwd(), "data/anmat/medicamentos.json");
const APPLY_BATCH_SIZE = 100;
const SPLIT_BATCH_SIZE = 100;

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function sqlEscape(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function sourceKey(item) {
  const raw = [item.droga, item.marca, item.presentacion, item.laboratorio]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .join("|");
  return createHash("sha1").update(raw).digest("hex").slice(0, 40);
}

function parsePrice(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

function parseSourceDate(fecha) {
  if (!fecha) return null;
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function normalizeRows(payload) {
  const list = Array.isArray(payload?.medicamentos) ? payload.medicamentos : [];
  const sourceUpdatedAt = parseSourceDate(payload?.fecha);
  const sourceFile = payload?.fuente ?? DEFAULT_URL;

  const byKey = new Map();
  for (const item of list) {
    const activeIngredient = String(item.droga ?? "").trim();
    const brandName = String(item.marca ?? "").trim();
    const presentation = String(item.presentacion ?? "").trim();
    if (!activeIngredient || !brandName || !presentation) continue;

    const key = sourceKey(item);
    // Last wins — avoids ON CONFLICT affecting the same row twice in one upsert batch.
    byKey.set(key, {
      sourceKey: key,
      activeIngredient,
      brandName,
      presentation,
      laboratory: String(item.laboratorio ?? "").trim() || null,
      referencePrice: parsePrice(item.precio),
      sourceUpdatedAt,
      sourceFile,
    });
  }

  return [...byKey.values()];
}

function buildInsertBatch(batch) {
  const values = batch
    .map(
      (r) =>
        `('${sqlEscape(r.sourceKey)}', 'siafar', '${sqlEscape(r.activeIngredient)}', '${sqlEscape(r.brandName)}', '${sqlEscape(r.presentation)}', ${
          r.laboratory ? `'${sqlEscape(r.laboratory)}'` : "NULL"
        }, ${r.referencePrice ?? "NULL"}, ${r.sourceUpdatedAt ? `'${r.sourceUpdatedAt}'` : "NULL"}, '${sqlEscape(r.sourceFile)}')`
    )
    .join(",\n  ");

  return `INSERT INTO national_medications (
  source_key, catalog_source, active_ingredient, brand_name, presentation, laboratory,
  reference_price, source_updated_at, source_file
) VALUES
  ${values}
ON CONFLICT (source_key) DO UPDATE SET
  active_ingredient = EXCLUDED.active_ingredient,
  brand_name = EXCLUDED.brand_name,
  presentation = EXCLUDED.presentation,
  laboratory = EXCLUDED.laboratory,
  reference_price = EXCLUDED.reference_price,
  source_updated_at = EXCLUDED.source_updated_at,
  source_file = EXCLUDED.source_file,
  is_active = true;`;
}

function runSqlFile(dbUrl, sqlPath) {
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--db-url", dbUrl, "-f", sqlPath],
    { stdio: "inherit", shell: true }
  );
  if (result.status !== 0) {
    throw new Error(`Falló ${sqlPath}. Revisá DATABASE_URL.`);
  }
}

async function downloadJson(url, targetPath) {
  mkdirSync(resolve(targetPath, ".."), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: ${res.status}`);
  const text = await res.text();
  writeFileSync(targetPath, text, "utf8");
  console.log(`✓ Descargado ${targetPath} (${text.length} bytes)`);
  return JSON.parse(text);
}

function applyBatches(dbUrl, rows, batchSize) {
  const total = Math.ceil(rows.length / batchSize);
  const tmpDir = resolve(process.cwd(), "supabase/seeds/.national_apply_tmp");
  mkdirSync(tmpDir, { recursive: true });

  console.log(`\n▶ Cargando ${rows.length} productos en ${total} lotes (${batchSize} filas c/u)...\n`);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = rows.slice(i, i + batchSize);
    const tmpPath = join(tmpDir, `batch_${String(batchNum).padStart(4, "0")}.sql`);
    writeFileSync(tmpPath, buildInsertBatch(batch), "utf8");
    console.log(`   Lote ${batchNum}/${total}...`);
    runSqlFile(dbUrl, tmpPath);
  }

  rmSync(tmpDir, { recursive: true, force: true });
  console.log("\n✓ Datos cargados en national_medications");
}

async function applyViaApi(url, serviceKey, rows) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const batchSize = 400;
  const total = Math.ceil(rows.length / batchSize);
  console.log(`\n▶ Cargando vía API (${total} lotes)...\n`);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = rows.slice(i, i + batchSize).map((r) => ({
      source_key: r.sourceKey,
      catalog_source: "siafar",
      active_ingredient: r.activeIngredient,
      brand_name: r.brandName,
      presentation: r.presentation,
      laboratory: r.laboratory,
      reference_price: r.referencePrice,
      source_updated_at: r.sourceUpdatedAt,
      source_file: r.sourceFile,
      is_active: true,
    }));
    const { error } = await supabase.from("national_medications").upsert(batch, {
      onConflict: "source_key",
    });
    if (error) throw new Error(`Lote ${batchNum}: ${error.message}`);
    console.log(`   Lote ${batchNum}/${total} OK`);
  }

  console.log("\n✓ Datos cargados en national_medications");
}

function writeSplitBatches(rows, splitDir, batchSize) {
  mkdirSync(splitDir, { recursive: true });
  const total = Math.ceil(rows.length / batchSize);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = rows.slice(i, i + batchSize);
    const fileName = `national_medications_${String(batchNum).padStart(3, "0")}.sql`;
    const header = `-- Lote ${String(batchNum).padStart(3, "0")}/${String(total).padStart(3, "0")} · filas ${i + 1}-${i + batch.length}\n\n`;
    writeFileSync(join(splitDir, fileName), header + buildInsertBatch(batch), "utf8");
  }

  console.log(`✓ ${total} archivos en ${splitDir}`);
}

async function main() {
  const args = process.argv.slice(2);
  const download = args.includes("--download");
  const apply = args.includes("--apply");
  const applyApi = args.includes("--apply-api");
  const splitIdx = args.indexOf("--split-dir");
  const fileIdx = args.indexOf("--file");
  const urlIdx = args.indexOf("--url");

  const filePath = fileIdx >= 0 ? resolve(process.cwd(), args[fileIdx + 1]) : DEFAULT_FILE;
  const splitDir = splitIdx >= 0 ? resolve(process.cwd(), args[splitIdx + 1]) : null;
  const sourceUrl = urlIdx >= 0 ? args[urlIdx + 1] : DEFAULT_URL;

  let payload;
  if (download) {
    payload = await downloadJson(sourceUrl, filePath);
  } else if (!existsSync(filePath)) {
    console.error(`No existe ${filePath}. Usá --download o --file <ruta>.`);
    process.exit(1);
  } else {
    payload = JSON.parse(readFileSync(filePath, "utf8"));
  }

  const rows = normalizeRows(payload);
  console.log(`Productos parseados: ${rows.length} únicos por source_key (fuente: ${payload?.fuente ?? "local"})`);

  if (splitDir) {
    writeSplitBatches(rows, splitDir, SPLIT_BATCH_SIZE);
  }

  if (apply || applyApi) {
    const env = loadEnv();
    if (applyApi) {
      const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
        env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
      if (!/^https?:\/\//i.test(url)) {
        throw new Error(
          `NEXT_PUBLIC_SUPABASE_URL inválida (${url.length} chars). ` +
            `Definí $env:NEXT_PUBLIC_SUPABASE_URL="https://nipqdarduknydqptqzup.supabase.co"`
        );
      }
      await applyViaApi(url, key, rows);
    } else {
      const dbUrl = process.env.DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
      if (!dbUrl) throw new Error("Falta DATABASE_URL en .env.local");
      applyBatches(dbUrl, rows, APPLY_BATCH_SIZE);
    }
  }

  if (!splitDir && !apply && !applyApi) {
    console.log("\nTip: --split-dir supabase/seeds/national_batches | --apply | --apply-api");
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
