import "server-only";

import { createHash, randomBytes } from "crypto";

import type { PublicApiAuthContext } from "@/core/public-api/types";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";

function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function authenticatePublicApiKey(
  request: Request
): Promise<{ ok: true; auth: PublicApiAuthContext } | { ok: false; status: number; message: string }> {
  if (!hasAdminClient()) {
    return { ok: false, status: 503, message: "API no disponible en este entorno" };
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer dfk_live_")) {
    return { ok: false, status: 401, message: "Authorization Bearer dfk_live_* requerido" };
  }

  const rawKey = header.slice("Bearer ".length).trim();
  if (rawKey.length < 20) {
    return { ok: false, status: 401, message: "Clave API inválida" };
  }

  const admin = createAdminClient();
  const keyHash = hashApiKey(rawKey);

  const { data: row, error } = await admin
    .from("clinic_api_keys")
    .select("id, clinic_id, name, scopes, is_active, expires_at, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !row || !row.is_active || row.revoked_at) {
    return { ok: false, status: 401, message: "Clave API inválida o revocada" };
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, message: "Clave API expirada" };
  }

  const { data: plugin } = await admin
    .from("clinic_plugins")
    .select("enabled")
    .eq("clinic_id", row.clinic_id)
    .eq("plugin_id", "public_api")
    .maybeSingle();

  if (plugin && plugin.enabled === false) {
    return { ok: false, status: 403, message: "API pública deshabilitada para esta clínica" };
  }

  void admin
    .from("clinic_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    ok: true,
    auth: {
      keyId: row.id,
      clinicId: row.clinic_id,
      scopes: (row.scopes as string[]) ?? [],
      keyName: row.name,
    },
  };
}

export function generatePublicApiKeyMaterial(): { secret: string; prefix: string; hash: string } {
  const secret = `dfk_live_${randomBytes(24).toString("base64url")}`;
  return {
    secret,
    prefix: secret.slice(0, 20),
    hash: hashApiKey(secret),
  };
}
