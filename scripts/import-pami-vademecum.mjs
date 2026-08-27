/**
 * Importa vademécum PAMI desde Excel Alfabeta/Gavade.
 *
 * Uso recomendado (conexión directa, lotes chicos):
 *   $env:DATABASE_URL="postgresql://postgres:PASS@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
 *   npm run import:pami-vademecum -- --apply
 *
 * Alternativa SQL Editor (archivos chicos):
 *   npm run import:pami-vademecum -- --split-dir supabase/seeds/pami_batches
 *   Ejecutá 042_pami_vademecum.sql y luego cada pami_vademecum_001.sql, 002.sql, ...
 *
 * Con service role (sin DATABASE_URL):
 *   npm run import:pami-vademecum -- --apply-api
 */
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { basename, join, resolve } from "path";
import XLSX from "xlsx";

const DEFAULT_XLSX = resolve(process.cwd(), "data/pami/gavade_20230829_102140.xlsx");
const APPLY_BATCH_SIZE = 50;
const SPLIT_BATCH_SIZE = 80;

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

function parseMoney(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

function parseCoverage(raw) {
  if (raw == null || raw === "") return null;
  const m = String(raw).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parsePriceListDate(headers) {
  for (const key of headers) {
    const m = String(key).match(/PVP PAMI AL (\d{2})\/(\d{2})\/(\d{4})/i);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

function parseRows(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) throw new Error("El Excel no tiene filas de datos.");

  const headers = Object.keys(rows[0]);
  const pvpKey = headers.find((h) => /^PVP PAMI/i.test(h));
  const priceListDate = parsePriceListDate(headers);
  const sourceFile = basename(filePath);

  const byKey = new Map();
  for (const row of rows) {
    const alfabetaId = Number(row.ALFABETA);
    const activeIngredient = String(row["PRINCIPIO ACTIVO"] ?? "").trim();
    const brandName = String(row["MARCA COMERCIAL"] ?? "").trim();
    const presentation = String(row.PRESENTACION ?? "").trim();
    const laboratory = String(row.LABORATORIO ?? "").trim();

    if (!alfabetaId || !activeIngredient || !brandName || !presentation) continue;

    byKey.set(`${alfabetaId}|${presentation}`, {
      alfabetaId,
      activeIngredient,
      brandName,
      presentation,
      laboratory: laboratory || null,
      pvpAmount: pvpKey ? parseMoney(row[pvpKey]) : null,
      coveragePct: parseCoverage(row.COBERTURA),
      affiliateAmount: parseMoney(row["IMPORTE AFILIADO"]),
      priceListDate,
      sourceFile,
    });
  }

  return [...byKey.values()];
}

function rowToDbRecord(r) {
  return {
    alfabeta_id: r.alfabetaId,
    active_ingredient: r.activeIngredient,
    brand_name: r.brandName,
    presentation: r.presentation,
    laboratory: r.laboratory,
    pvp_amount: r.pvpAmount,
    coverage_pct: r.coveragePct,
    affiliate_amount: r.affiliateAmount,
    price_list_date: r.priceListDate,
    source_file: r.sourceFile,
  };
}

function buildInsertBatch(batch) {
  const values = batch
    .map(
      (r) =>
        `(${r.alfabetaId}, '${sqlEscape(r.activeIngredient)}', '${sqlEscape(r.brandName)}', '${sqlEscape(r.presentation)}', ${
          r.laboratory ? `'${sqlEscape(r.laboratory)}'` : "NULL"
        }, ${r.pvpAmount ?? "NULL"}, ${r.coveragePct ?? "NULL"}, ${r.affiliateAmount ?? "NULL"}, ${
          r.priceListDate ? `'${r.priceListDate}'` : "NULL"
        }, '${sqlEscape(r.sourceFile)}')`
    )
    .join(",\n  ");

  return `INSERT INTO pami_vademecum (
  alfabeta_id, active_ingredient, brand_name, presentation, laboratory,
  pvp_amount, coverage_pct, affiliate_amount, price_list_date, source_file
) VALUES
  ${values}
ON CONFLICT (alfabeta_id, presentation) DO UPDATE SET
  active_ingredient = EXCLUDED.active_ingredient,
  brand_name = EXCLUDED.brand_name,
  laboratory = EXCLUDED.laboratory,
  pvp_amount = EXCLUDED.pvp_amount,
  coverage_pct = EXCLUDED.coverage_pct,
  affiliate_amount = EXCLUDED.affiliate_amount,
  price_list_date = EXCLUDED.price_list_date,
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

function applyBatches(dbUrl, rows, batchSize) {
  const total = Math.ceil(rows.length / batchSize);
  const tmpDir = resolve(process.cwd(), "supabase/seeds/.pami_apply_tmp");
  mkdirSync(tmpDir, { recursive: true });

  console.log(`\n▶ Cargando ${rows.length} productos en ${total} lotes (${batchSize} filas c/u)...\n`);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batch = rows.slice(i, i + batchSize);
    const tmpPath = join(tmpDir, `batch_${String(batchNum).padStart(3, "0")}.sql`);
    writeFileSync(tmpPath, buildInsertBatch(batch), "utf8");
    console.log(`   Lote ${batchNum}/${total}...`);
    runSqlFile(dbUrl, tmpPath);
  }

  rmSync(tmpDir, { recursive: true, force: true });
  console.log("\n✓ Datos cargados en pami_vademecum");
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
    const batch = rows.slice(i, i + batchSize).map(rowToDbRecord);
    const { error } = await supabase
      .from("pami_vademecum")
      .upsert(batch, { onConflict: "alfabeta_id,presentation" });

    if (error) {
      throw new Error(`Lote ${batchNum}: ${error.message}`);
    }
    console.log(`   ✓ Lote ${batchNum}/${total} (${Math.min(i + batchSize, rows.length)}/${rows.length})`);
  }

  console.log("\n✓ Datos cargados en pami_vademecum");
}

function splitSqlFiles(rows, outDir, batchSize) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const total = Math.ceil(rows.length / batchSize);
  for (let i = 0; i < rows.length; i += batchSize) {
    const n = String(Math.floor(i / batchSize) + 1).padStart(3, "0");
    const filePath = join(outDir, `pami_vademecum_${n}.sql`);
    const header = `-- Lote ${n}/${String(total).padStart(3, "0")} · filas ${i + 1}-${Math.min(i + batchSize, rows.length)}\n\n`;
    writeFileSync(filePath, header + buildInsertBatch(rows.slice(i, i + batchSize)), "utf8");
  }

  writeFileSync(
    join(outDir, "README.txt"),
    [
      "Ejecutá en Supabase SQL Editor EN ESTE ORDEN:",
      "1. supabase/migrations/042_pami_vademecum.sql (solo una vez)",
      "2. pami_vademecum_001.sql, 002.sql, ... hasta el último",
      "",
      `Total: ${total} archivos, ${rows.length} productos.`,
      "No pegues pami_vademecum_data.sql completo: el editor lo rechaza por tamaño.",
    ].join("\n"),
    "utf8"
  );

  console.log(`✓ ${total} archivos en ${outDir}`);
}

function generateSql(rows, batchSize) {
  const chunks = ["-- Vademécum PAMI generado automáticamente", `-- Registros: ${rows.length}`, ""];
  for (let i = 0; i < rows.length; i += batchSize) {
    chunks.push(buildInsertBatch(rows.slice(i, i + batchSize)));
    chunks.push("");
  }
  return chunks.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const sqlOutIdx = args.indexOf("--sql-out");
  const splitDirIdx = args.indexOf("--split-dir");
  const apply = args.includes("--apply");
  const applyApi = args.includes("--apply-api");
  const skipValues = new Set(
    [sqlOutIdx, sqlOutIdx + 1, splitDirIdx, splitDirIdx + 1].filter((i) => i >= 0)
  );
  const fileArg = args.find((a, i) => !a.startsWith("--") && !skipValues.has(i));
  const filePath = resolve(fileArg ?? DEFAULT_XLSX);

  if (!existsSync(filePath)) {
    console.error(`❌ No se encontró el Excel: ${filePath}`);
    process.exit(1);
  }

  console.log(`\n📦 Leyendo ${filePath}`);
  const rows = parseRows(filePath);
  console.log(`   ${rows.length} productos parseados`);

  const env = loadEnv();
  const dbUrl = process.env.DATABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (apply) {
    if (!dbUrl) {
      console.error(`
❌ Falta DATABASE_URL para --apply

PowerShell:
  $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
  npm run import:pami-vademecum -- --apply

O usá --apply-api con SUPABASE_SERVICE_ROLE_KEY en .env.local
O generá lotes chicos: npm run import:pami-vademecum -- --split-dir supabase/seeds/pami_batches
`);
      process.exit(1);
    }
    applyBatches(dbUrl, rows, APPLY_BATCH_SIZE);
    return;
  }

  if (applyApi) {
    if (!serviceKey || !supabaseUrl) {
      console.error("❌ Falta SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL en .env.local");
      process.exit(1);
    }
    if (!/^https?:\/\//i.test(supabaseUrl)) {
      console.error(
        `❌ NEXT_PUBLIC_SUPABASE_URL inválida. Definí $env:NEXT_PUBLIC_SUPABASE_URL="https://….supabase.co"`
      );
      process.exit(1);
    }
    await applyViaApi(supabaseUrl, serviceKey, rows);
    return;
  }

  if (splitDirIdx >= 0) {
    const outDir = resolve(args[splitDirIdx + 1] ?? "supabase/seeds/pami_batches");
    splitSqlFiles(rows, outDir, SPLIT_BATCH_SIZE);
    console.log("\nEjecutá cada archivo en SQL Editor (ver README.txt en esa carpeta).");
    return;
  }

  if (sqlOutIdx >= 0) {
    const outPath = resolve(args[sqlOutIdx + 1]);
    writeFileSync(outPath, generateSql(rows, 200), "utf8");
    console.log(`✓ SQL generado: ${outPath}`);
    console.log("⚠️  El archivo completo es demasiado grande para SQL Editor. Usá --apply o --split-dir.");
    return;
  }

  const defaultOut = resolve(process.cwd(), "supabase/seeds/pami_vademecum_data.sql");
  writeFileSync(defaultOut, generateSql(rows, 200), "utf8");
  console.log(`✓ SQL generado: ${defaultOut}`);
  console.log(`
Para cargar en Supabase (elegí una opción):

  A) Conexión directa (recomendado):
     $env:DATABASE_URL="postgresql://postgres:PASS@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
     npm run import:pami-vademecum -- --apply

  B) Service role en .env.local:
     npm run import:pami-vademecum -- --apply-api

  C) SQL Editor (lotes chicos):
     npm run import:pami-vademecum -- --split-dir supabase/seeds/pami_batches
`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
