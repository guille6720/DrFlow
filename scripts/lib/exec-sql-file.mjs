/**
 * Execute a .sql file against Postgres one statement at a time.
 * Uses a single pg connection (avoids Supabase CLI multi-connect timeouts).
 * Falls back to `supabase db query` when pg is unavailable.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function stripLeadingLineComments(sql) {
  return sql.replace(/^(\s*--[^\n]*(\r?\n|$))+/u, "").trim();
}

/** Split SQL on semicolons outside quotes, dollar-quoted blocks, and line comments. */
export function splitSqlStatements(sql) {
  const statements = [];
  let buf = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (!inSingle && !inDouble && !dollarTag && ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        buf += sql[i];
        i++;
      }
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && ch === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (!inDouble && ch === "'" && !inSingle) {
      inSingle = true;
      buf += ch;
      i++;
      continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'" && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }

    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      buf += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && ch === ";") {
      const trimmed = stripLeadingLineComments(buf);
      if (trimmed) {
        statements.push(trimmed);
      }
      buf = "";
      i++;
      continue;
    }

    buf += ch;
    i++;
  }

  const tail = stripLeadingLineComments(buf);
  if (tail) statements.push(tail);
  return statements;
}

export function assertDbOutputOk(text, context) {
  if (/LegacyDbQueryExecError|LegacyDbQueryUnexpectedStatusError|"ERROR:/i.test(text)) {
    throw new Error(`${context}: ${text.slice(0, 1500)}`);
  }
}

function isTransientError(err) {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("connection timed out") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("connection terminated") ||
    msg.includes("server closed the connection") ||
    msg.includes("connect timeout")
  );
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function loadPgClient() {
  try {
    const mod = await import("pg");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

async function withPgClient(dbUrl, fn) {
  const pg = await loadPgClient();
  if (!pg?.Client) {
    return null;
  }
  const client = new pg.Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 60_000,
    ssl: dbUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function runSingleSqlPg(client, sql, { label, retries = 4 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await client.query(sql);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === retries) {
        throw new Error(`${label ?? "SQL"} failed: ${err.message}`);
      }
      const waitMs = attempt * 3000;
      console.warn(`  retry ${attempt}/${retries - 1} for ${label ?? "SQL"} in ${waitMs}ms (${err.message})`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

export async function runSingleSqlCli(dbUrl, sql, { label, retries = 4 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const tmp = resolve(process.cwd(), `.tmp-sql-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
    writeFileSync(tmp, sql, "utf8");
    try {
      const result = spawnSync(
        "npx",
        ["supabase", "db", "query", "--db-url", dbUrl, "-f", tmp],
        { encoding: "utf8", shell: true, stdio: "pipe" }
      );
      const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      if (result.status !== 0) {
        const err = new Error(`${label ?? "SQL"} failed (exit ${result.status}): ${text.slice(0, 1500)}`);
        if (isTransientError(text) && attempt < retries) {
          lastErr = err;
          const waitMs = attempt * 3000;
          console.warn(`  retry ${attempt}/${retries - 1} for ${label ?? "SQL"} in ${waitMs}ms`);
          await sleep(waitMs);
          continue;
        }
        throw err;
      }
      assertDbOutputOk(text, label ?? "SQL");
      return text;
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr;
}

export async function runSqlFile(dbUrl, filePath, { verbose = true, fromStatement = 1 } = {}) {
  const abs = resolve(process.cwd(), filePath);
  if (!existsSync(abs)) {
    throw new Error(`Missing SQL file: ${filePath}`);
  }
  const raw = readFileSync(abs, "utf8");
  const statements = splitSqlStatements(raw);
  if (statements.length === 0) {
    throw new Error(`No SQL statements found in ${filePath}`);
  }
  const start = Math.max(1, Number(fromStatement) || 1);
  if (verbose) {
    const suffix = start > 1 ? `, from #${start}` : "";
    console.log(`Applying ${filePath} (${statements.length} statements${suffix})...`);
  }

  const pg = await loadPgClient();
  if (pg?.Client) {
    const client = new pg.Client({
      connectionString: dbUrl,
      connectionTimeoutMillis: 60_000,
      ssl: dbUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
    });
    await client.connect();
    try {
      for (let n = start; n <= statements.length; n++) {
        const stmt = statements[n - 1];
        const preview = stmt.split("\n").find((l) => l.trim() && !l.trim().startsWith("--"))?.trim().slice(0, 72);
        await runSingleSqlPg(client, stmt, { label: `${filePath} #${n} ${preview ?? ""}` });
        if (verbose && n % 10 === 0) {
          console.log(`  ... ${n}/${statements.length}`);
        }
      }
    } finally {
      await client.end().catch(() => {});
    }
  } else {
    console.warn("pg not installed — falling back to supabase CLI (slower, one connection per statement).");
    console.warn("Run: npm install");
    for (let n = start; n <= statements.length; n++) {
      const stmt = statements[n - 1];
      const preview = stmt.split("\n").find((l) => l.trim() && !l.trim().startsWith("--"))?.trim().slice(0, 72);
      await runSingleSqlCli(dbUrl, stmt, { label: `${filePath} #${n} ${preview ?? ""}` });
      if (verbose && n % 10 === 0) {
        console.log(`  ... ${n}/${statements.length}`);
      }
    }
  }

  if (verbose) console.log(`OK ${filePath} (${statements.length} statements)`);
  return statements.length;
}

export async function queryJson(dbUrl, sql) {
  const result = await withPgClient(dbUrl, (client) => client.query(sql));
  if (result == null) {
    throw new Error("pg not installed — cannot run queryJson. Run: npm install");
  }
  return result.rows ?? [];
}
