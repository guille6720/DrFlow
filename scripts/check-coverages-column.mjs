import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const path = resolve(process.cwd(), ".env.local");
if (!existsSync(path)) {
  console.error("No .env.local");
  process.exit(1);
}
const env = {};
for (const line of readFileSync(path, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const res = await fetch(`${url}/rest/v1/clinics?select=id,accepted_coverages&limit=1`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
});
const body = await res.text();
console.log(`HTTP ${res.status}`);
if (res.status === 400 && body.includes("accepted_coverages")) {
  console.log("❌ Columna accepted_coverages NO existe — migración 030 pendiente");
} else if (res.ok || res.status === 200) {
  console.log("✓ Columna accepted_coverages disponible");
  console.log(body.slice(0, 200));
} else {
  console.log(body.slice(0, 300));
}
