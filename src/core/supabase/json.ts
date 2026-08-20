import type { Json } from "@/types/supabase";

/** RPC optional args: Postgres null → omit / undefined for generated Args. */
export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

function isJson(value: unknown): value is Json {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJson);
  if (t === "object") {
    return Object.values(value as Record<string, unknown>).every(
      (entry) => entry === undefined || isJson(entry)
    );
  }
  return false;
}

/** Narrow unknown/object payloads to Supabase Json without unsafe casts. */
export function toJson(value: unknown): Json {
  if (!isJson(value)) {
    throw new Error("Value is not JSON-compatible for Supabase Json columns");
  }
  return value;
}

export function toJsonObject(value: Record<string, unknown>): { [key: string]: Json | undefined } {
  const json = toJson(value);
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Expected a JSON object");
  }
  return json;
}

/** Postgres `inet` / unknown IP columns → string | null. */
export function ipAddressFromUnknown(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
