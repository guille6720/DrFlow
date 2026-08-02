/**
 * Importa vademécum PAMI desde Excel Alfabeta/Gavade.
 *
 * Uso:
 *   node scripts/import-pami-vademecum.mjs "C:\Users\...\gavade_20230829_102140.xlsx"
 *   node scripts/import-pami-vademecum.mjs --sql-out supabase/seeds/pami_vademecum_data.sql
 *   DATABASE_URL=... node scripts/import-pami-vademecum.mjs --apply
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { spawnSync } from "child_process";
import XLSX from "xlsx";

const DEFAULT_XLSX = resolve(
  process.cwd(),
  "data/pami/gavade_20230829_102140.xlsx"
);

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
  return Number.isFinite(n) ? n.toFixed(2) : null;
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

  const parsed = [];
  for (const row of rows) {
    const alfabetaId = Number(row.ALFABETA);
    const activeIngredient = String(row["PRINCIPIO ACTIVO"] ?? "").trim();
    const brandName = String(row["MARCA COMERCIAL"] ?? "").trim();
    const presentation = String(row.PRESENTACION ?? "").trim();
    const laboratory = String(row.LABORATORIO ?? "").trim();

    if (!alfabetaId || !activeIngredient || !brandName || !presentation) continue;

    parsed.push({
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

  return parsed;
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

function generateSql(rows) {
  const chunks = ["-- Vademécum PAMI generado automáticamente", `-- Registros: ${rows.length}`, ""];
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    chunks.push(buildInsertBatch(rows.slice(i, i + batchSize)));
    chunks.push("");
  }
  return chunks.join("\n");
}

function applySql(dbUrl, sqlPath) {
  console.log(`▶ Aplicando ${sqlPath} ...`);
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--db-url", dbUrl, "-f", sqlPath],
    { stdio: "inherit", shell: true }
  );
  if (result.status !== 0) {
    throw new Error("Falló la carga SQL. Revisá DATABASE_URL o ejecutá el SQL en Supabase.");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const sqlOutIdx = args.indexOf("--sql-out");
  const apply = args.includes("--apply");
  const fileArg = args.find((a) => !a.startsWith("--") && a !== args[sqlOutIdx + 1]);
  const filePath = resolve(fileArg ?? DEFAULT_XLSX);

  if (!existsSync(filePath)) {
    console.error(`❌ No se encontró el Excel: ${filePath}`);
    process.exit(1);
  }

  console.log(`\n📦 Leyendo ${filePath}`);
  const rows = parseRows(filePath);
  console.log(`   ${rows.length} productos parseados`);

  const sql = generateSql(rows);

  if (sqlOutIdx >= 0) {
    const outPath = resolve(args[sqlOutIdx + 1]);
    writeFileSync(outPath, sql, "utf8");
    console.log(`✓ SQL generado: ${outPath}`);
  }

  const env = loadEnv();
  const dbUrl = process.env.DATABASE_URL?.trim();

  if (apply) {
    if (!dbUrl) {
      console.error("❌ Falta DATABASE_URL para --apply");
      process.exit(1);
    }
    const tmpSql = resolve(process.cwd(), "supabase/seeds/.pami_vademecum_import.tmp.sql");
    writeFileSync(tmpSql, sql, "utf8");
    applySql(dbUrl, tmpSql);
    console.log("✓ Datos cargados en pami_vademecum");
  } else if (!sqlOutIdx) {
    const defaultOut = resolve(process.cwd(), "supabase/seeds/pami_vademecum_data.sql");
    writeFileSync(defaultOut, sql, "utf8");
    console.log(`✓ SQL generado: ${defaultOut}`);
    console.log("\nPara cargar en Supabase:");
    console.log("  1. Ejecutá supabase/migrations/042_pami_vademecum.sql");
    console.log("  2. Pegá supabase/seeds/pami_vademecum_data.sql en SQL Editor");
    console.log("  O: DATABASE_URL=... node scripts/import-pami-vademecum.mjs --apply");
  }

  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log(`\nSupabase: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  }
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
