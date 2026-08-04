#!/usr/bin/env node
/**
 * Imprime URLs para Supabase → Authentication → URL Configuration
 * Uso: node scripts/print-supabase-redirects.mjs [https://tu-dominio.com]
 */
const site =
  process.argv[2] ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://TU-DOMINIO.vercel.app");

const base = site.replace(/\/$/, "");

console.log("\n=== Supabase → Authentication → URL Configuration ===\n");
console.log("Site URL (DEBE ser el subdominio DrFlow, NO opusorg.com raíz):");
console.log(`  ${base}\n`);
console.log("Redirect URLs (recomendado: wildcards + rutas exactas):");
[
  `${base}/**`,
  `${base}/auth/callback`,
  `${base}/auth/confirm`,
  `${base}/auth/complete`,
  `${base}/login/restablecer`,
  `${base}/login`,
  `${base}/register`,
  `${base}/onboarding`,
  "https://drflow-app-rho.vercel.app/**",
  "https://drflow-app-rho.vercel.app/auth/callback",
  "https://drflow-app-rho.vercel.app/auth/confirm",
  "https://drflow-app-rho.vercel.app/auth/complete",
  "https://drflow-app-rho.vercel.app/login/restablecer",
  "http://localhost:3000/**",
  "http://localhost:3000/auth/callback",
  "http://localhost:3000/auth/confirm",
  "http://localhost:3000/auth/complete",
  "http://localhost:3000/login/restablecer",
].forEach((u) => console.log(`  ${u}`));

console.log("\n=== Si el mail de reset te manda a opusorg.com (sin drflow) ===\n");
console.log("  1. Site URL mal puesta (opusorg.com o vercel.app sin drflow.opusorg.com)");
console.log("  2. Falta redirect URL con query params → usá wildcards " + base + "/**");
console.log("  3. En Vercel: NEXT_PUBLIC_SITE_URL=" + base);
console.log("  4. Aplicar desde repo: npx supabase config push --yes\n");

console.log("\n=== Google OAuth (Authentication → Providers → Google) ===\n");
console.log("1. Activá Google provider");
console.log("2. Client ID y Client Secret desde Google Cloud Console");
console.log("3. En Google Cloud → Authorized redirect URIs:");
console.log("   https://nipqdarduknydqptqzup.supabase.co/auth/v1/callback");
console.log("   (reemplazá por tu project ref si es otro)\n");

console.log("=== Vercel → Environment Variables ===\n");
console.log("  NEXT_PUBLIC_SITE_URL=" + base);
console.log("  NEXT_PUBLIC_SUPABASE_URL=...");
console.log("  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...");
console.log("  SUPABASE_SERVICE_ROLE_KEY=... (opcional)\n");
