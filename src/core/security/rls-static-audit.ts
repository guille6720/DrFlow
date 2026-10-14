/**
 * Auditoría estática de RLS sobre el SQL de migraciones.
 * Reconoce sentencias literales y bloques `FOREACH <var> IN ARRAY ARRAY[...] LOOP ... END LOOP`
 * que ejecutan `EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', <var>)` y
 * `EXECUTE format('CREATE POLICY %I ON public.%I ...', ..., <var>)`.
 */

export type RlsCoverage = {
  rlsEnabled: Set<string>;
  rlsDisabled: Set<string>;
  withPolicies: Set<string>;
};

export type RlsAuditResult = {
  missingRls: string[];
  missingPolicies: string[];
  disabledRls: string[];
};

const TABLE_NAME = "(?:public\\.)?\"?([a-z_][a-z0-9_]*)\"?";

const LITERAL_ENABLE = new RegExp(
  `ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${TABLE_NAME}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
  "gi"
);
const LITERAL_DISABLE = new RegExp(
  `ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${TABLE_NAME}\\s+DISABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
  "gi"
);
const LITERAL_POLICY = new RegExp(
  `CREATE\\s+POLICY\\s+(?:"[^"]+"|\\w+)\\s+ON\\s+${TABLE_NAME}\\b`,
  "gi"
);

const FOREACH_ARRAY_LOOP =
  /FOREACH\s+(\w+)\s+IN\s+ARRAY\s+ARRAY\s*\[([\s\S]*?)\]\s*LOOP([\s\S]*?)END\s+LOOP/gi;

const DYNAMIC_ENABLE = /^\s*EXECUTE\s+format\s*\(\s*'ALTER\s+TABLE\s+(?:public\.)?%I\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY'/i;
const DYNAMIC_POLICY = /^\s*EXECUTE\s+format\s*\(\s*'CREATE\s+POLICY\s+%I\s+ON\s+(?:public\.)?%I\b/i;

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function collectLiteral(pattern: RegExp, sql: string, into: Set<string>) {
  for (const match of sql.matchAll(pattern)) {
    into.add(match[1].toLowerCase());
  }
}

/** True when the format() arguments after the SQL template reference the loop variable. */
function formatArgsUseVariable(statement: string, variable: string): boolean {
  const args = statement.slice(statement.lastIndexOf("'") + 1);
  return new RegExp(`\\b${variable}\\b`, "i").test(args);
}

function collectLoops(sql: string, coverage: RlsCoverage) {
  for (const [, variable, arrayBody, loopBody] of sql.matchAll(FOREACH_ARRAY_LOOP)) {
    const tables = [...arrayBody.matchAll(/'(?:public\.)?([a-z_][a-z0-9_]*)'/gi)].map((m) =>
      m[1].toLowerCase()
    );
    const statements = loopBody.split(";");
    const enables = statements.some(
      (stmt) => DYNAMIC_ENABLE.test(stmt) && formatArgsUseVariable(stmt, variable)
    );
    const createsPolicies = statements.some(
      (stmt) => DYNAMIC_POLICY.test(stmt) && formatArgsUseVariable(stmt, variable)
    );
    for (const table of tables) {
      if (enables) coverage.rlsEnabled.add(table);
      if (createsPolicies) coverage.withPolicies.add(table);
    }
  }
}

export function collectRlsCoverage(sql: string): RlsCoverage {
  const clean = stripSqlComments(sql);
  const coverage: RlsCoverage = {
    rlsEnabled: new Set(),
    rlsDisabled: new Set(),
    withPolicies: new Set(),
  };
  collectLiteral(LITERAL_ENABLE, clean, coverage.rlsEnabled);
  collectLiteral(LITERAL_DISABLE, clean, coverage.rlsDisabled);
  collectLiteral(LITERAL_POLICY, clean, coverage.withPolicies);
  collectLoops(clean, coverage);
  return coverage;
}

export function auditRlsCoverage(sql: string, tables: readonly string[]): RlsAuditResult {
  const coverage = collectRlsCoverage(sql);
  return {
    missingRls: tables.filter((t) => !coverage.rlsEnabled.has(t)),
    missingPolicies: tables.filter((t) => !coverage.withPolicies.has(t)),
    disabledRls: tables.filter((t) => coverage.rlsDisabled.has(t)),
  };
}
