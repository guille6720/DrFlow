// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-8222-222222222222";
const APPOINTMENT = "33333333-3333-4333-8333-333333333333";

type RpcResult = { data: unknown; error: { message: string } | null };

const state = vi.hoisted(() => ({
  snapshotByClinic: new Map<string, unknown>(),
  snapshotError: null as { message: string } | null,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  members: [] as { clinic_id: string; role: string }[],
  cookieClinicId: null as string | null,
  superadminOk: true,
}));

function chain(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lt", "neq", "not", "order", "limit", "in"]) {
    builder[m] = () => builder;
  }
  builder.maybeSingle = async () => result;
  builder.then = (resolveFn: (v: unknown) => unknown) => Promise.resolve(result).then(resolveFn);
  return builder;
}

vi.mock("@/core/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: (table: string) => {
      if (table === "clinic_members") return chain({ data: state.members, error: null });
      if (table === "profiles") return chain({ data: { is_superadmin: false }, error: null });
      return chain({ data: [], error: null });
    },
    rpc: async (fn: string, args: Record<string, unknown>): Promise<RpcResult> => {
      state.rpcCalls.push({ fn, args });
      if (fn === "get_feature_settings_snapshot") {
        if (state.snapshotError) return { data: null, error: state.snapshotError };
        return { data: state.snapshotByClinic.get(String(args.p_clinic_id)) ?? null, error: null };
      }
      return { data: { ok: true }, error: null };
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "drflow_clinic_id" && state.cookieClinicId ? { value: state.cookieClinicId } : undefined,
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/core/auth/session.actions", () => ({ logAudit: vi.fn(async () => undefined) }));

vi.mock("@/core/actions/clinic-guard", () => ({
  requireClinicPermission: async () => ({ ok: true, clinicId: CLINIC_A, userId: "user-1" }),
}));

vi.mock("@/core/entitlements/superadmin-guard.server", () => ({
  requireSuperadminOrDeny: async () =>
    state.superadminOk ? { ok: true, userId: "sa-1" } : { ok: false, error: "Solo superadmin." },
  requireSuperadminPage: async () => ({ userId: "sa-1" }),
}));

vi.mock("@/core/auth/dashboard-page", () => ({
  getDashboardPageContext: async () => ({
    profile: { full_name: "Secretaria" },
    clinics: [],
    clinicId: CLINIC_A,
    role: "secretary",
    isSuperadmin: false,
    clinic: { timezone: "America/Argentina/Buenos_Aires" },
  }),
}));

vi.mock("@/features/administracion", () => ({ WaitingRoomView: () => null }));
vi.mock("@/core/components/layout/header", () => ({ Header: () => null }));

const disabledSnapshot = {
  definitions: [],
  clinic: [{ feature_key: "waiting_room", enabled: false, config: null }],
  user: [],
};

function waitingRoomRequest() {
  return new NextRequest("http://localhost/api/waiting-room/status", {
    method: "POST",
    headers: {
      host: "localhost",
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify({ appointmentId: APPOINTMENT, status: "confirmed" }),
  });
}

beforeEach(() => {
  state.snapshotByClinic.clear();
  state.snapshotError = null;
  state.rpcCalls = [];
  state.members = [{ clinic_id: CLINIC_A, role: "secretary" }];
  state.cookieClinicId = CLINIC_A;
  state.superadminOk = true;
});

describe("Test E — direct URL blocked", () => {
  it("/sala-espera redirects to /dashboard when waiting_room is disabled for the clinic", async () => {
    state.snapshotByClinic.set(CLINIC_A, disabledSnapshot);
    const { default: SalaEsperaPage } = await import("@/app/(dashboard)/sala-espera/page");
    await expect(SalaEsperaPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(state.rpcCalls.some((c) => c.fn === "get_feature_settings_snapshot")).toBe(true);
  }, 30_000);

  it("page guard lets the request through when there is no configuration", async () => {
    const { requireFeaturePage } = await import("@/core/customizations/customizations.server");
    await expect(requireFeaturePage(CLINIC_A, "waiting_room")).resolves.toBeUndefined();
  });
});

describe("Test F — direct API call returns 403 FEATURE_DISABLED", () => {
  it("POST /api/waiting-room/status is rejected before touching appointments", async () => {
    state.snapshotByClinic.set(CLINIC_A, disabledSnapshot);
    const { POST } = await import("@/app/api/waiting-room/status/route");
    const res = await POST(waitingRoomRequest());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: "FEATURE_DISABLED", feature: "waiting_room" });
    expect(state.rpcCalls.some((c) => c.fn === "update_waiting_room_status_atomic")).toBe(false);
  }, 30_000);

  it("server action returns FEATURE_DISABLED and does not mutate", async () => {
    state.snapshotByClinic.set(CLINIC_A, disabledSnapshot);
    const { updateWaitingRoomStatus } = await import("@/lib/actions/waiting-room");
    const result = await updateWaitingRoomStatus(APPOINTMENT, "confirmed");
    expect(result).toMatchObject({ error: "FEATURE_DISABLED", feature: "waiting_room" });
    expect(state.rpcCalls.some((c) => c.fn === "update_waiting_room_status_atomic")).toBe(false);
  }, 30_000);

  it("Test G — without configuration the API behaves as before", async () => {
    const { POST } = await import("@/app/api/waiting-room/status/route");
    const res = await POST(waitingRoomRequest());
    expect(res.status).toBe(200);
    expect(state.rpcCalls.some((c) => c.fn === "update_waiting_room_status_atomic")).toBe(true);
  });

  it("DB unavailable (tables/RPC missing) falls back to current behavior", async () => {
    state.snapshotError = { message: "function get_feature_settings_snapshot does not exist" };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/waiting-room/status/route");
    const res = await POST(waitingRoomRequest());
    expect(res.status).toBe(200);
    warn.mockRestore();
  });
});

describe("Test C — cross-tenant isolation (app layer)", () => {
  it("clinic A's disabled setting never affects clinic B", async () => {
    state.snapshotByClinic.set(CLINIC_A, disabledSnapshot);
    state.members = [{ clinic_id: CLINIC_B, role: "secretary" }];
    state.cookieClinicId = CLINIC_B;
    const { POST } = await import("@/app/api/waiting-room/status/route");
    const res = await POST(waitingRoomRequest());
    expect(res.status).toBe(200);
    const snapshotCall = state.rpcCalls.find((c) => c.fn === "get_feature_settings_snapshot");
    expect(snapshotCall?.args).toEqual({ p_clinic_id: CLINIC_B });
  });

  it("a forged cookie for another clinic is remapped to the caller's own membership", async () => {
    state.snapshotByClinic.set(CLINIC_B, { clinic: [], user: [] });
    state.members = [{ clinic_id: CLINIC_B, role: "secretary" }];
    state.cookieClinicId = CLINIC_A;
    const { POST } = await import("@/app/api/waiting-room/status/route");
    const res = await POST(waitingRoomRequest());
    expect(res.status).toBe(200);
    const snapshotCall = state.rpcCalls.find((c) => c.fn === "get_feature_settings_snapshot");
    expect(snapshotCall?.args).toEqual({ p_clinic_id: CLINIC_B });
  });
});

describe("Test D — non-superadmin cannot modify (app layer)", () => {
  it("save/reset actions are rejected before any RPC", async () => {
    state.superadminOk = false;
    const { saveFeatureCustomizationAction, resetFeatureCustomizationAction } = await import(
      "@/lib/actions/superadmin-customizations"
    );
    const saved = await saveFeatureCustomizationAction({
      clinicId: CLINIC_A,
      featureKey: "waiting_room",
      enabled: false,
    });
    const reset = await resetFeatureCustomizationAction({ clinicId: CLINIC_A, featureKey: "waiting_room" });
    expect(saved.ok).toBe(false);
    expect(reset.ok).toBe(false);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("critical changes require explicit confirmation even for Superadmin", async () => {
    const { saveFeatureCustomizationAction } = await import("@/lib/actions/superadmin-customizations");
    const result = await saveFeatureCustomizationAction({
      clinicId: CLINIC_A,
      featureKey: "unlimited_patients",
      enabled: false,
    });
    expect(result.ok).toBe(false);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("invalid JSON config is rejected server-side", async () => {
    const { saveFeatureCustomizationAction } = await import("@/lib/actions/superadmin-customizations");
    const bad = await saveFeatureCustomizationAction({
      clinicId: CLINIC_A,
      featureKey: "waiting_room",
      enabled: null,
      configJson: '{"show_document_number":"yes"}',
    });
    const notJson = await saveFeatureCustomizationAction({
      clinicId: CLINIC_A,
      featureKey: "waiting_room",
      enabled: null,
      configJson: "{oops",
    });
    expect(bad.ok).toBe(false);
    expect(notJson.ok).toBe(false);
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("Superadmin save sends validated payload with server-derived environment", async () => {
    const { saveFeatureCustomizationAction } = await import("@/lib/actions/superadmin-customizations");
    const result = await saveFeatureCustomizationAction({
      clinicId: CLINIC_A,
      userId: "44444444-4444-4444-8444-444444444444",
      featureKey: "waiting_room",
      enabled: false,
      configJson: '{"show_document_number":false}',
      reason: "prueba",
    });
    expect(result.ok).toBe(true);
    const call = state.rpcCalls.find((c) => c.fn === "set_user_feature_setting");
    expect(call?.args).toMatchObject({
      p_clinic_id: CLINIC_A,
      p_user_id: "44444444-4444-4444-8444-444444444444",
      p_feature_key: "waiting_room",
      p_enabled: false,
      p_config: { show_document_number: false },
    });
    expect(typeof call?.args.p_environment).toBe("string");
  });
});
