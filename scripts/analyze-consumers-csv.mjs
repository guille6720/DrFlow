import fs from "fs";
import { parseConsumerImportLines } from "../src/lib/utils/consumers-import-parse.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/analyze-consumers-csv.mjs <path>");
  process.exit(1);
}

const text = fs.readFileSync(path, "utf8");
const lines = text.split(/\r?\n/).filter((l) => l.trim());
const { records, errors } = parseConsumerImportLines(lines, 50000);

const pami = records.filter((r) => r.insurance_provider === "PAMI").length;
const withPhone = records.filter((r) => r.phone).length;
const withEmail = records.filter((r) => r.email).length;
const withBirth = records.filter((r) => r.birth_date).length;
const withConsumer = records.filter((r) => r.external_consumer_id?.startsWith("consumers/")).length;

console.log(
  JSON.stringify(
    {
      totalLines: lines.length - 1,
      importedOk: records.length,
      parseErrors: errors.length,
      errorSamples: errors.slice(0, 15),
      withPami: pami,
      withPhone,
      withEmail,
      withBirthDate: withBirth,
      withConsumerId: withConsumer,
      hasClinicalHistoryInFile: false,
      note: "Este archivo es solo padron de pacientes (consumers), no incluye evoluciones ni tratamientos.",
    },
    null,
    2
  )
);
