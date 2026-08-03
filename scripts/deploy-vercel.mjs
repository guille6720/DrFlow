#!/usr/bin/env node
/**
 * Deploy de producción vía GitHub → Vercel API.
 * Evita `vercel deploy --prod` (CLI) que quedaba en estado UNKNOWN en este proyecto.
 *
 * Requisitos: `npx vercel link` hecho una vez + sesión CLI (`npx vercel login`).
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = "drflow-app";
const TEAM_ID = "team_VrhiG4SSZCvo5W6OO4RzRu1m";
const GITHUB = { org: "guille6720", repo: "DrFlow", ref: "main" };
const PRODUCTION_URL = "https://drflow.opusorg.com";

function loadToken() {
  const paths = [
    join(process.env.APPDATA ?? "", "xdg.data", "com.vercel.cli", "auth.json"),
    join(homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const data = JSON.parse(readFileSync(p, "utf8"));
    if (data.token) return data.token;
  }
  throw new Error("No hay sesión Vercel. Ejecutá: npx vercel login");
}

async function api(path, { method = "GET", body } = {}) {
  const token = loadToken();
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error?.message ?? json.message ?? res.statusText;
    throw new Error(`Vercel API ${res.status}: ${msg}`);
  }
  return json;
}

async function waitReady(deploymentId, timeoutMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const d = await api(
      `/v13/deployments/${deploymentId}?teamId=${TEAM_ID}`,
    );
    process.stdout.write(`\r  estado: ${d.readyState}   `);
    if (d.readyState === "READY") {
      console.log("");
      return d;
    }
    if (d.readyState === "ERROR" || d.readyState === "CANCELED") {
      console.log("");
      throw new Error(d.errorMessage ?? `Deploy ${d.readyState}`);
    }
    await new Promise((r) => setTimeout(r, 8_000));
  }
  throw new Error("Timeout esperando deploy");
}

async function main() {
  console.log(`Deploy ${PROJECT} (GitHub ${GITHUB.ref}) → producción…`);
  const created = await api(`/v13/deployments?teamId=${TEAM_ID}`, {
    method: "POST",
    body: {
      name: PROJECT,
      target: "production",
      gitSource: { type: "github", ...GITHUB },
    },
  });

  const url = created.url ? `https://${created.url}` : created.alias?.[0];
  console.log(`  id: ${created.id}`);
  console.log(`  url: ${url ?? "(pendiente)"}`);

  await waitReady(created.id);

  console.log(`✓ Producción actualizada`);
  if (url) console.log(`  preview: ${url}`);

  try {
    const version = await fetch(`${PRODUCTION_URL}/api/version`).then((r) =>
      r.json(),
    );
    console.log(`  ${PRODUCTION_URL}/api/version → buildId ${version.buildId}`);
  } catch {
    console.log(`  Verificá: ${PRODUCTION_URL}/api/version`);
  }
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
