-- READ-ONLY catalog audit: table/view privileges held by anon and authenticated, classified by what the
-- Supabase Data API (PostgREST / GraphQL) can actually exercise. Reads catalogs only, never table rows.
-- Set "exposed" to the schemas listed in Dashboard > API settings > Exposed schemas.
--
-- exposure values:
--   SQL_ONLY                   TRUNCATE / MAINTAIN / TRIGGER / REFERENCES: no Data API endpoint can issue these;
--                              reachable only through a SQL path (SECURITY INVOKER function, direct DB login, injection).
--   API_EXPOSED_NO_RLS         table in an exposed schema with RLS disabled: the grant alone decides access.
--   API_VIEW_OWNER_RIGHTS      view without security_invoker: runs as the owner and bypasses the base tables' RLS.
--   API_POLICY_GATED           RLS on and a permissive policy covers this role + command: reachable, rows filtered by policy.
--   GRANT_ONLY_DENIED_BY_RLS   RLS on and no permissive policy for this role + command: the grant is dead weight
--                              (INSERT errors, UPDATE/DELETE affect 0 rows).
--   NOT_API_EXPOSED            schema not exposed (or no USAGE): reachable only through SQL.
WITH exposed(schema_name) AS (VALUES ('public'), ('graphql_public')),
roles(role_name) AS (VALUES ('anon'), ('authenticated')),
rels AS (
  SELECT c.oid, n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl,
         COALESCE((SELECT option_value::BOOLEAN FROM pg_options_to_table(c.reloptions) WHERE option_name = 'security_invoker'), false) AS view_invoker
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    AND n.nspname NOT LIKE 'pg_temp%'
),
grants AS (
  SELECT r.*, ro.role_name, a.privilege_type
  FROM rels r
  CROSS JOIN LATERAL aclexplode(COALESCE(r.relacl, acldefault('r', (SELECT relowner FROM pg_class WHERE oid = r.oid)))) a
  JOIN roles ro ON a.grantee = (SELECT oid FROM pg_roles WHERE rolname = ro.role_name) OR a.grantee = 0
  WHERE a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'MAINTAIN', 'TRIGGER', 'REFERENCES')
),
classified AS (
  SELECT g.nspname AS schema_name, g.relname AS object_name,
         CASE g.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned' WHEN 'v' THEN 'view' WHEN 'm' THEN 'matview' ELSE 'foreign' END AS kind,
         g.role_name, g.privilege_type, g.relrowsecurity AS rls_enabled,
         CASE
           WHEN g.privilege_type IN ('TRUNCATE', 'MAINTAIN', 'TRIGGER', 'REFERENCES') THEN 'SQL_ONLY'
           WHEN NOT EXISTS (SELECT 1 FROM exposed e WHERE e.schema_name = g.nspname)
                OR NOT has_schema_privilege(g.role_name, g.nspname, 'USAGE') THEN 'NOT_API_EXPOSED'
           WHEN g.relkind = 'v' AND NOT g.view_invoker THEN 'API_VIEW_OWNER_RIGHTS'
           WHEN g.relkind IN ('r', 'p') AND NOT g.relrowsecurity THEN 'API_EXPOSED_NO_RLS'
           WHEN EXISTS (
             SELECT 1 FROM pg_policy p
             WHERE p.polrelid = g.oid AND p.polpermissive
               AND p.polcmd IN ('*', CASE g.privilege_type WHEN 'INSERT' THEN 'a' WHEN 'UPDATE' THEN 'w' ELSE 'd' END)
               AND (0 = ANY (p.polroles) OR (SELECT oid FROM pg_roles WHERE rolname = g.role_name) = ANY (p.polroles))
           ) THEN 'API_POLICY_GATED'
           ELSE 'GRANT_ONLY_DENIED_BY_RLS'
         END AS exposure
  FROM grants g
)
SELECT exposure, role_name, privilege_type, kind, count(*) AS objects,
       string_agg(schema_name || '.' || object_name, ', ' ORDER BY schema_name, object_name) AS object_list
FROM classified
GROUP BY exposure, role_name, privilege_type, kind
ORDER BY CASE exposure WHEN 'API_EXPOSED_NO_RLS' THEN 1 WHEN 'API_VIEW_OWNER_RIGHTS' THEN 2 WHEN 'API_POLICY_GATED' THEN 3
                       WHEN 'GRANT_ONLY_DENIED_BY_RLS' THEN 4 WHEN 'SQL_ONLY' THEN 5 ELSE 6 END,
         role_name, privilege_type, kind;
