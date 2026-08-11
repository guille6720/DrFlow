import { describe, expect, it } from "vitest";

import {
  buildJitsiRoomUrl,
  buildPatientJoinPath,
  buildTelemedicineEmbedUrl,
  extractJitsiRoomName,
  isTelemedicineSessionJoinable,
} from "@/core/telemedicine/provider";

import { buildTelemedicineMessage } from "@/lib/services/telemedicine";

describe("telemedicine provider", () => {
  it("builds jitsi room url from appointment id", () => {
    const url = buildJitsiRoomUrl("drflow-abc123");
    expect(url).toBe("https://meet.jit.si/drflow-abc123");
    expect(extractJitsiRoomName(url)).toBe("drflow-abc123");
  });

  it("builds embed url with display name hash", () => {
    const embed = buildTelemedicineEmbedUrl("https://meet.jit.si/sala-test", "Dr. Castro");
    expect(embed).toContain("meet.jit.si/sala-test");
    expect(embed).toContain("userInfo.displayName");
  });

  it("builds patient join path", () => {
    expect(buildPatientJoinPath("11111111-1111-1111-1111-111111111111")).toBe(
      "/videoconsulta/11111111-1111-1111-1111-111111111111"
    );
  });

  it("validates join window around appointment", () => {
    const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      isTelemedicineSessionJoinable({
        status: "scheduled",
        expiresAt: null,
        appointmentStartAt: start,
      })
    ).toBe(true);
    expect(
      isTelemedicineSessionJoinable({
        status: "completed",
        expiresAt: null,
        appointmentStartAt: start,
      })
    ).toBe(false);
  });
});

describe("buildTelemedicineMessage", () => {
  it("includes patient link and clinic", () => {
    const text = buildTelemedicineMessage({
      patientName: "Ana López",
      appointmentDate: "12 de agosto, 15:00",
      clinicName: "Consultorio Castro",
      joinUrl: "https://drflow.opusorg.com/videoconsulta/abc",
    });
    expect(text).toContain("Ana López");
    expect(text).toContain("Consultorio Castro");
    expect(text).toContain("/videoconsulta/abc");
  });
});

describe("telemedicine migration 101", () => {
  it("defines provider columns and status RPC", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile("supabase/migrations/101_telemedicine_phase2d.sql", "utf8");
    expect(sql).toMatch(/provider TEXT/);
    expect(sql).toMatch(/update_telemedicine_session_status/);
    expect(sql).toMatch(/ON CONFLICT \(appointment_id\)/);
  });
});
