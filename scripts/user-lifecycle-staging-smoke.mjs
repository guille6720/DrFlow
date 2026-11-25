#!/usr/bin/env node
/**
 * Staging smoke for migration 159 — synthetic user lifecycle.
 * Creates a throwaway Auth user + membership, runs deactivate/reactivate/unlink/delete,
 * then verifies email can be re-registered. Never targets production.
 *
 * Usage (PowerShell):
 *   $env:CONFIRM_STAGING_PROJECT_REF="gprmsufvhabntbrytwyi"
 *   $env:STAGING_SUPABASE_URL="https://gprmsufvhabntbrytwyi.supabase.co"
 *   $env:STAGING_SERVICE_ROLE_KEY="..."
 *   $env:STAGING_CLINIC_ID="<uuid of a staging clinic with ≥2 admins or a disposable clinic>"
 *   $env:STAGING_ACTOR_ACCESS_TOKEN="<jwt of a clinic_admin or superadmin in that clinic>"
 *   node scripts/user-lifecycle-staging-smoke.mjs
 */
import { createClient } from "@supabase/supabase-js";

import { PRODUCTION_REF, STAGING_REF } from "./supabase-project-refs.mjs";

function fail(msg) {
  console.error(`\nFAIL: ${msg}\n`);
  process.exit(1);
}

if (process.env.CONFIRM_STAGING_PROJECT_REF !== STAGING_REF) {
  fail(`Set CONFIRM_STAGING_PROJECT_REF=${STAGING_REF}`);
}

const url = process.env.STAGING_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.STAGING_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const actorToken = process.env.STAGING_ACTOR_ACCESS_TOKEN;
const clinicId = process.env.STAGING_CLINIC_ID;

if (!url || !serviceKey) fail("Missing STAGING_SUPABASE_URL / STAGING_SERVICE_ROLE_KEY");
if (!actorToken) fail("Missing STAGING_ACTOR_ACCESS_TOKEN");
if (!clinicId) fail("Missing STAGING_CLINIC_ID");
if (/nipqdarduknydqptqzup|production/i.test(url) || url.includes(PRODUCTION_REF)) {
  fail("Refusing to run against production URL");
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const actor = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || serviceKey, {
  global: { headers: { Authorization: `Bearer ${actorToken}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const email = `lifecycle.smoke.${stamp}@example.invalid`;
const password = `Smoke-${stamp}-Aa1!`;

console.log(`Staging lifecycle smoke → ${STAGING_REF}`);
console.log(`Synthetic email: ${email}`);

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: `Smoke ${stamp}` },
});
if (createErr || !created.user) fail(createErr?.message || "createUser failed");
const userId = created.user.id;

await admin.from("profiles").upsert({
  id: userId,
  email,
  full_name: `Smoke ${stamp}`,
});

const { error: memberErr } = await admin.from("clinic_members").insert({
  clinic_id: clinicId,
  user_id: userId,
  role: "secretary",
  is_active: true,
});
if (memberErr) fail(`clinic_members insert: ${memberErr.message}`);

async function rpc(name) {
  const { data, error } = await actor.rpc(name, {
    p_clinic_id: clinicId,
    p_user_id: userId,
  });
  if (error) fail(`${name}: ${error.message}`);
  console.log(`OK ${name}`, data);
  return data;
}

await rpc("admin_deactivate_clinic_member");
await rpc("admin_reactivate_clinic_member");

// Unlink then re-add membership for permanent delete test
await rpc("admin_unlink_clinic_member");
{
  const { error } = await admin.from("clinic_members").insert({
    clinic_id: clinicId,
    user_id: userId,
    role: "secretary",
    is_active: true,
  });
  if (error) fail(`re-insert member: ${error.message}`);
}

await rpc("admin_permanently_delete_clinic_user");

const { data: gone } = await admin.auth.admin.getUserById(userId);
if (gone?.user) fail("Auth user still exists after permanent delete");

const { data: recreated, error: recreateErr } = await admin.auth.admin.createUser({
  email,
  password: `${password}-2`,
  email_confirm: true,
});
if (recreateErr || !recreated.user) fail(`email not free for re-register: ${recreateErr?.message}`);
await admin.auth.admin.deleteUser(recreated.user.id);

console.log("\nPASS — deactivate/reactivate/unlink/delete + email re-register OK on staging.");
process.exit(0);
