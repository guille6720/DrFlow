import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEVICE_SESSION_COOKIE, MAX_DEVICE_SESSIONS } from "@/lib/auth/device-sessions";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/109_user_device_sessions.sql"),
  "utf8"
);

describe("109_user_device_sessions migration", () => {
  it("creates device session table and claim RPC with max 3", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS user_device_sessions/);
    expect(sql).toMatch(/claim_user_device_session/);
    expect(sql).toMatch(/touch_user_device_session/);
    expect(sql).toMatch(/revoke_user_device_session/);
    expect(sql).toMatch(/p_max_sessions INT DEFAULT 3/);
  });
});

describe("device session constants", () => {
  it("limits concurrent devices to 3", () => {
    expect(MAX_DEVICE_SESSIONS).toBe(3);
    expect(DEVICE_SESSION_COOKIE).toBe("drflow_device_session");
  });
});
