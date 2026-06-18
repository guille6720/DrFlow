/**
 * Verifica si un email existe en Supabase Auth (sin crear usuarios).
 * Uso: node scripts/check-auth-email.mjs email@ejemplo.com
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.error("❌ No existe .env.local");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const email = process.argv[2];
if (!email) {
  console.error("Uso: node scripts/check-auth-email.mjs tu@email.com");
  process.exit(1);
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`\n🔍 Auth — ${email}\n`);

if (service) {
  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
      },
    }
  );
  const data = await res.json();
  if (!res.ok) {
    console.log("❌ Admin API:", data.msg ?? res.status);
  } else if (!data.users?.length) {
    console.log("❌ Este email NO está registrado.");
    console.log("   → Andá a /register y creá la cuenta con ese email.");
  } else {
    const u = data.users[0];
    console.log("✓ Usuario encontrado");
    console.log(`  Email confirmado: ${u.email_confirmed_at ? "SÍ" : "NO — confirmá en Supabase → Users"}`);
    console.log(`  Último login: ${u.last_sign_in_at ?? "nunca"}`);
    console.log("  Si la contraseña falla: Supabase → Users → Send password recovery");
  }
} else {
  // Intento de login con contraseña inválida — no crea usuarios
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "__probe_invalid__" }),
  });
  const body = await res.json();
  const msg = (body.error_description ?? body.msg ?? "").toLowerCase();

  if (msg.includes("email not confirmed")) {
    console.log("✓ El email está registrado pero NO confirmado.");
    console.log("  → Supabase → Authentication → Users → Confirm user");
  } else if (msg.includes("invalid") || msg.includes("credentials")) {
    console.log("? El email puede estar registrado con otra contraseña, o no existir.");
    console.log("  Supabase no distingue ambos casos por seguridad.");
    console.log("  → Probá registrarte en /register (si ya existe, te lo dirá).");
    console.log("  → O reseteá contraseña en Supabase → Users → Send password recovery");
  } else {
    console.log("Respuesta:", body.error_description ?? body.msg ?? JSON.stringify(body));
  }
}

console.log("");
