/**
 * Lighthouse audit — public marketing routes (production build).
 * Usage: node scripts/lighthouse-audit.mjs [--url=http://localhost:3000]
 */
import { spawn, spawnSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.split("=")[1] ?? "http://localhost:3000";
const OUT_DIR = resolve(process.cwd(), "coverage/lighthouse");
const ROUTES = ["/", "/login", "/privacidad", "/terminos", "/demo"];

function waitForServer(url, attempts = 60) {
  return new Promise((resolvePromise, reject) => {
    let n = 0;
    const tick = async () => {
      n += 1;
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok || res.status === 307 || res.status === 308) {
          resolvePromise();
          return;
        }
      } catch {
        // retry
      }
      if (n >= attempts) {
        reject(new Error(`Server not ready: ${url}`));
        return;
      }
      setTimeout(tick, 1000);
    };
    tick();
  });
}

function runLighthouse(url, outPath) {
  const args = [
    url,
    "--output=json",
    `--output-path=${outPath}`,
    "--quiet",
    "--chrome-flags=--headless --no-sandbox --disable-gpu",
    "--only-categories=performance,accessibility,best-practices,seo",
  ];

  const bin = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(bin, ["lighthouse", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH },
  });
  return result.status ?? 1;
}

function extractScores(jsonPath) {
  const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
  const c = raw.categories ?? {};
  return {
    performance: Math.round((c.performance?.score ?? 0) * 100),
    accessibility: Math.round((c.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((c["best-practices"]?.score ?? 0) * 100),
    seo: Math.round((c.seo?.score ?? 0) * 100),
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const shouldStart = !process.argv.includes("--no-start");
  let serverProc = null;

  if (shouldStart) {
    console.log("\n🔨 Building production bundle…\n");
    const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, DOCKER_BUILD: undefined },
    });
    if (build.status !== 0) process.exit(build.status ?? 1);

    console.log("\n🚀 Starting next start…\n");
    serverProc = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "start"], {
      stdio: "ignore",
      shell: process.platform === "win32",
      detached: process.platform !== "win32",
    });
    await waitForServer(BASE);
  }

  const summary = [];
  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    const slug = route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
    const outPath = resolve(OUT_DIR, `${slug}.report.json`);
    console.log(`\n📊 Lighthouse → ${url}\n`);
    const code = runLighthouse(url, outPath);
    if (code !== 0 && !readFileSync(outPath, "utf8").includes('"categories"')) {
      console.warn(`⚠ Lighthouse failed for ${url} (exit ${code})`);
      continue;
    }
    const scores = extractScores(outPath);
    summary.push({ route, url, ...scores });
    console.log(
      `   Perf ${scores.performance} · A11y ${scores.accessibility} · BP ${scores.bestPractices} · SEO ${scores.seo}`
    );
  }

  const reportPath = resolve(OUT_DIR, "summary.json");
  writeFileSync(reportPath, JSON.stringify({ auditedAt: new Date().toISOString(), base: BASE, routes: summary }, null, 2));
  console.log(`\n✅ Summary → ${reportPath}\n`);

  if (serverProc) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(serverProc.pid), "/f", "/t"], { stdio: "ignore", shell: true });
    } else {
      process.kill(-serverProc.pid);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
