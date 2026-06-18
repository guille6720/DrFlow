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
console.log("Site URL:");
console.log(`  ${base}\n`);
console.log("Redirect URLs (agregar todas):");
[
  `${base}/auth/callback`,
  `${base}/login/restablecer`,
  `${base}/login`,
  `${base}/register`,
  `${base}/onboarding`,
  "http://localhost:3000/auth/callback",
  "http://localhost:3000/login/restablecer",
].forEach((u) => console.log(`  ${u}`));
console.log("\n=== Vercel → Environment Variables ===\n");
console.log("  NEXT_PUBLIC_SITE_URL=" + base);
console.log("  NEXT_PUBLIC_SUPABASE_URL=...");
console.log("  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...");
console.log("  SUPABASE_SERVICE_ROLE_KEY=... (opcional)\n");
