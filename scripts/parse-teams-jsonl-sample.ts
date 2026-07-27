import fs from "fs";
import { parseTeamsJsonlContent } from "../src/lib/utils/teams-jsonl-parse";

const path = process.argv[2] ?? "c:/Users/pigus/Downloads/teams-6dac9267.jsonl";
const content = fs.readFileSync(path, "utf8");
const { rows, stats, errors } = parseTeamsJsonlContent(content);
console.log({ stats, errorCount: errors.length, sample: rows.slice(0, 2) });
const abalo = rows.filter((r) => r.paciente_id === "consumers/c110e15f");
console.log("abalo rows", abalo.length, abalo.map((r) => r.tipo_registro));
