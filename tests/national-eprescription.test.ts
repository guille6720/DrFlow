import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { FEATURE_CUSTOMIZATION_REGISTRY } from "@/core/customizations/registry";
import {
  type ProfessionalValidationResponse,
  validateProfessionalWithRefeps,
} from "@/core/refeps/professional-validation";
import {
  cancelNationalPrescription,
  submitNationalPrescription,
} from "@/core/renapdis/national-prescription/orchestrator";
import type {
  NationalRxAuditEvent,
  NationalRxAuditMetadata,
  NationalRxDeps,
  NationalRxGates,
  NationalRxPatch,
  NationalRxRecord,
  NationalRxStore,
} from "@/core/renapdis/national-prescription/types";
import { evaluateNationalRxReadiness } from "@/core/renapdis/national-readiness";
import { NATIONAL_RX_STATES, transitionNationalRx } from "@/core/renapdis/national-state-machine";
import { createExternalRepositoryProvider, type ExternalRepositoryAdapter } from "@/core/renapdis/providers/external";
import { resolveRepositoryProvider } from "@/core/renapdis/providers/index";
import { createNotConfiguredProvider } from "@/core/renapdis/providers/not-configured";
import { createSandboxRepositoryProvider, SANDBOX_REFERENCE_PREFIX } from "@/core/renapdis/providers/sandbox";
import { computeBackoffDelay, withRepositoryRetry } from "@/core/renapdis/repository/repository-client";
import {
  type RepositoryConfig,
  resolveRefepsValidationConfig,
  resolveRepositoryConfig,
} from "@/core/renapdis/repository/repository-config";
import {
  classifyHttpStatus,
  isRetryableRepositoryError,
  RepositoryProviderError,
} from "@/core/renapdis/repository/repository-errors";
import type { PrescriptionRepositoryProvider } from "@/core/renapdis/repository/repository-provider";
import type { NationalPrescriptionRequest } from "@/core/renapdis/repository/repository-types";
import { assertValidProviderResponse } from "@/core/renapdis/repository/repository-validation";

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-8222-222222222222";
const RX_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RX_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER = "99999999-9999-4999-8999-999999999999";
/** Synthetic, structurally valid (Anexo IV shape) test fixture — not a real CUIR. */
const TEST_OFFICIAL_SHAPED_CUIR = "0001000202000112301";

const OPEN_GATES: NationalRxGates = {
  hasPermission: true,
  productEntitled: true,
  featureEnabled: true,
  mfaElevated: true,
  establishmentCode: "EST-TEST",
};

const SANDBOX_CONFIG = resolveRepositoryConfig({ RENAPDIS_REPOSITORY_PROVIDER: "sandbox" });
const EXTERNAL_CONFIG: RepositoryConfig = {
  providerId: "test-external",
  mode: "external",
  configured: true,
  authMode: "api_key",
  missing: [],
  reason: "ok",
  apiUrl: "https://repository.test.invalid",
  timeoutMs: 2_000,
};

function baseRecord(id: string, clinicId: string): NationalRxRecord {
  return {
    id,
    clinicId,
    status: "issued",
    professionalId: "pro-1",
    patientId: "pat-1",
    nationalState: null,
    nationalUpdatedAt: null,
    submissionId: null,
    idempotencyKey: null,
    correlationId: null,
    attempts: 0,
    repositoryProvider: null,
    repositoryMode: null,
    repositoryPrescriptionId: null,
    repositoryStatus: null,
    sandboxReference: null,
    cuir: null,
    errorCode: null,
    refepsProfessionalStatus: null,
    refepsValidationMode: null,
  };
}

const PATCH_TO_RECORD: Partial<Record<keyof NationalRxPatch, keyof NationalRxRecord>> = {
  national_rx_state: "nationalState",
  national_submission_id: "submissionId",
  national_idempotency_key: "idempotencyKey",
  national_correlation_id: "correlationId",
  national_attempts: "attempts",
  repository_provider: "repositoryProvider",
  repository_mode: "repositoryMode",
  repository_prescription_id: "repositoryPrescriptionId",
  repository_status: "repositoryStatus",
  repository_error_code: "errorCode",
  sandbox_reference: "sandboxReference",
  cuir: "cuir",
  refeps_professional_status: "refepsProfessionalStatus",
  refeps_validation_mode: "refepsValidationMode",
};

/** In-memory store with the same compare-and-set semantics and invariants as the DB trigger. */
function createMemoryStore(records: NationalRxRecord[]) {
  const rows = new Map(records.map((r) => [r.id, { ...r }]));
  let tick = 0;
  const store: NationalRxStore = {
    async load(id, clinicId) {
      await Promise.resolve();
      const row = rows.get(id);
      return row && row.clinicId === clinicId ? { ...row } : null;
    },
    async update(id, clinicId, expected, patch) {
      await Promise.resolve();
      const row = rows.get(id);
      if (!row || row.clinicId !== clinicId || row.nationalUpdatedAt !== expected) return null;
      if (patch.national_rx_state) {
        const t = transitionNationalRx(row.nationalState ?? "issued_local", patch.national_rx_state, {
          cuir: patch.cuir ?? row.cuir,
          repositoryMode: patch.repository_mode ?? row.repositoryMode,
        });
        if (!t.ok && patch.national_rx_state !== row.nationalState) throw new Error(`invalid transition ${t.error}`);
      }
      if (row.cuir && patch.cuir !== undefined && patch.cuir !== row.cuir) throw new Error("cuir immutable");
      if (row.sandboxReference && patch.sandbox_reference !== undefined && patch.sandbox_reference !== row.sandboxReference) {
        throw new Error("sandbox_reference immutable");
      }
      const next = { ...row } as Record<string, unknown>;
      for (const [k, v] of Object.entries(patch)) {
        const field = PATCH_TO_RECORD[k as keyof NationalRxPatch];
        if (field) next[field] = v;
      }
      if (next.cuir && next.sandboxReference) throw new Error("cuir and sandbox_reference are exclusive");
      tick += 1;
      next.nationalUpdatedAt = new Date(Date.UTC(2026, 8, 28, 12, 0, 0) + tick).toISOString();
      rows.set(id, next as NationalRxRecord);
      return { ...(next as NationalRxRecord) };
    },
  };
  return { store, rows };
}

function fakeRequest(record: NationalRxRecord, submissionId: string, establishmentCode: string): NationalPrescriptionRequest {
  return {
    submissionId,
    prescriptionId: record.id,
    prescriptionNumber: "RX-TEST-1",
    issuedAt: "2026-09-28T12:00:00.000Z",
    validityDays: 30,
    category: "ambulatoria",
    establishment: { code: establishmentCode },
    professional: {
      refepsProfessionalId: null,
      documentNumber: "00000001",
      licenseNumber: "MN-TEST",
      licenseJurisdiction: null,
      profession: "medicina",
    },
    patient: {
      documentType: "DNI",
      documentNumber: "00000002",
      cuil: null,
      firstName: "Test",
      lastName: "Paciente",
      birthDate: null,
      sex: null,
      coverage: null,
    },
    diagnosis: { code: null, system: null, text: null },
    items: [{ genericName: "Paracetamol", presentation: null, quantity: 1, posology: "c/8h" }],
  };
}

type Harness = {
  deps: NationalRxDeps;
  rows: Map<string, NationalRxRecord>;
  audits: Array<{ event: NationalRxAuditEvent; metadata: NationalRxAuditMetadata }>;
  providerCalls: () => number;
  validationCalls: () => number;
};

function createHarness(options: {
  records?: NationalRxRecord[];
  provider?: PrescriptionRepositoryProvider;
  config?: RepositoryConfig;
  validation?: ProfessionalValidationResponse;
}): Harness {
  const { store, rows } = createMemoryStore(options.records ?? [baseRecord(RX_A, CLINIC_A)]);
  const audits: Harness["audits"] = [];
  let providerCalls = 0;
  let validationCalls = 0;
  const inner = options.provider ?? createSandboxRepositoryProvider();
  const provider: PrescriptionRepositoryProvider = {
    ...inner,
    async submitPrescription(request, ctx) {
      providerCalls += 1;
      return inner.submitPrescription(request, ctx);
    },
  };
  let seq = 0;
  const deps: NationalRxDeps = {
    store,
    data: {
      async buildSubmission(record, submissionId, establishmentCode) {
        return {
          ok: true,
          request: fakeRequest(record, submissionId, establishmentCode),
          refepsInput: { documentNumber: "00000001", licenseNumber: "MN-TEST", profession: null, jurisdiction: null },
        };
      },
    },
    audit: async (event, metadata) => {
      audits.push({ event, metadata });
    },
    provider,
    repositoryConfig: options.config ?? SANDBOX_CONFIG,
    validateProfessional: async () => {
      validationCalls += 1;
      return options.validation ?? { valid: true, status: "validated", mode: "sandbox", validatedAt: "2026-09-28T12:00:00.000Z" };
    },
    now: () => new Date("2026-09-28T12:00:10.000Z"),
    uuid: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
    retryHooks: { sleep: async () => {}, random: () => 0 },
  };
  return { deps, rows, audits, providerCalls: () => providerCalls, validationCalls: () => validationCalls };
}

function externalProvider(
  behavior: (attempt: number) => Promise<{ cuir: string | null } | never>
): PrescriptionRepositoryProvider {
  let attempt = 0;
  return {
    id: "test-external",
    mode: "external",
    async submitPrescription() {
      attempt += 1;
      const r = await behavior(attempt);
      return assertValidProviderResponse({
        mode: "external",
        providerId: "test-external",
        repositoryPrescriptionId: "ext-1",
        providerRequestId: "req-1",
        status: r.cuir ? "registered" : "pending",
        cuir: r.cuir,
      });
    },
    async getPrescriptionStatus() {
      throw new RepositoryProviderError("unsupported_operation");
    },
    async verifyCuir() {
      throw new RepositoryProviderError("unsupported_operation");
    },
    async cancelPrescription(id) {
      return { providerId: "test-external", repositoryPrescriptionId: id, cancelled: true };
    },
  };
}

const OFFICIAL_VALID: ProfessionalValidationResponse = {
  valid: true,
  status: "validated",
  mode: "official",
  validatedAt: "2026-09-28T12:00:00.000Z",
};

describe("A — feature disabled: local prescriptions unaffected", () => {
  it("blocks the national flow without touching the prescription", async () => {
    const h = createHarness({});
    const result = await submitNationalPrescription(
      { clinicId: CLINIC_A, userId: USER },
      { ...OPEN_GATES, featureEnabled: false },
      RX_A,
      h.deps
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("feature_disabled");
    expect(h.rows.get(RX_A)?.nationalState).toBeNull();
    expect(h.rows.get(RX_A)?.status).toBe("issued");
    expect(h.providerCalls()).toBe(0);
    expect(h.validationCalls()).toBe(0);
  });

  it("feature is registered OFF by default and critical", () => {
    const def = FEATURE_CUSTOMIZATION_REGISTRY.national_electronic_prescription;
    expect(def).toBeDefined();
    expect(def.defaultEnabled).toBe(false);
  });
});

describe("B — REFEPS unavailable", () => {
  it("blocks national submission and never calls the repository", async () => {
    const h = createHarness({ validation: { valid: false, status: "unavailable", mode: "unavailable" } });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("refeps_unavailable");
      expect(result.recoverable).toBe(true);
    }
    expect(h.providerCalls()).toBe(0);
    expect(h.rows.get(RX_A)?.nationalState).toBe("professional_validation_failed");
  });

  it("official REFEPS config without an implemented client reports unavailable, never validated", async () => {
    const res = await validateProfessionalWithRefeps(
      { documentNumber: "1", licenseNumber: "2", profession: null, jurisdiction: null },
      { env: { REFEPS_VALIDATION_API_URL: "https://refeps.test.invalid", REFEPS_VALIDATION_API_KEY: "placeholder" } }
    );
    expect(res.valid).toBe(false);
    expect(res.status).toBe("unavailable");
  });

  it("without any configuration REFEPS is unavailable (not silently validated)", async () => {
    const res = await validateProfessionalWithRefeps(
      { documentNumber: "1", licenseNumber: "2", profession: null, jurisdiction: null },
      { env: {} }
    );
    expect(res).toMatchObject({ valid: false, status: "unavailable", mode: "unavailable" });
  });

  it("sandbox REFEPS is blocked in production", async () => {
    const res = await validateProfessionalWithRefeps(
      { documentNumber: "1", licenseNumber: "2", profession: null, jurisdiction: null },
      { env: { REFEPS_VALIDATION_MODE: "sandbox", VERCEL_ENV: "production" } }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("sandbox_blocked_in_production");
  });
});

describe("C — invalid professional", () => {
  it("does not call the repository", async () => {
    const h = createHarness({ validation: { valid: false, status: "not_found", mode: "sandbox" } });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("professional_invalid");
    expect(h.providerCalls()).toBe(0);
  });

  it("an external repository requires OFFICIAL REFEPS validation (sandbox validation is rejected)", async () => {
    const h = createHarness({
      provider: externalProvider(async () => ({ cuir: TEST_OFFICIAL_SHAPED_CUIR })),
      config: EXTERNAL_CONFIG,
    });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("official_validation_required");
    expect(h.providerCalls()).toBe(0);
    expect(h.rows.get(RX_A)?.cuir).toBeNull();
  });
});

describe("D — repository unavailable", () => {
  it("retries retryable errors, ends in repository_unavailable and stores no CUIR", async () => {
    const h = createHarness({
      provider: externalProvider(async () => {
        throw new RepositoryProviderError("provider_unavailable", { httpStatus: 503 });
      }),
      config: EXTERNAL_CONFIG,
      validation: OFFICIAL_VALID,
    });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider_unavailable");
      expect(result.state).toBe("repository_unavailable");
      expect(result.recoverable).toBe(true);
    }
    expect(h.providerCalls()).toBe(3);
    const row = h.rows.get(RX_A)!;
    expect(row.cuir).toBeNull();
    expect(row.sandboxReference).toBeNull();
    expect(row.nationalState).toBe("repository_unavailable");
  });

  it("does not retry non-retryable errors", async () => {
    const h = createHarness({
      provider: externalProvider(async () => {
        throw new RepositoryProviderError("invalid_patient", { httpStatus: 422 });
      }),
      config: EXTERNAL_CONFIG,
      validation: OFFICIAL_VALID,
    });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.state).toBe("repository_submission_failed");
    expect(h.providerCalls()).toBe(1);
  });

  it("a malformed CUIR from the repository is rejected (invalid_response) and never persisted", async () => {
    const h = createHarness({
      provider: externalProvider(async () => ({ cuir: "SBX-NOT-A-CUIR" })),
      config: EXTERNAL_CONFIG,
      validation: OFFICIAL_VALID,
    });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_response");
    expect(h.rows.get(RX_A)?.cuir).toBeNull();
    expect(h.rows.get(RX_A)?.nationalState).not.toBe("cuir_assigned");
  });

  it("an official-shaped CUIR from an external repository reaches cuir_assigned", async () => {
    const h = createHarness({
      provider: externalProvider(async () => ({ cuir: TEST_OFFICIAL_SHAPED_CUIR })),
      config: EXTERNAL_CONFIG,
      validation: OFFICIAL_VALID,
    });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result).toMatchObject({ ok: true, outcome: "cuir_assigned", cuir: TEST_OFFICIAL_SHAPED_CUIR });
    expect(h.audits.map((a) => a.event)).toContain("cuir_received");
  });
});

describe("E — sandbox mode", () => {
  it("stores only sandbox_reference, never a CUIR, and never reaches cuir_assigned", async () => {
    const h = createHarness({});
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome).toBe("registered_sandbox");
      expect(result.cuir).toBeNull();
      expect(result.sandboxReference?.startsWith(SANDBOX_REFERENCE_PREFIX)).toBe(true);
    }
    const row = h.rows.get(RX_A)!;
    expect(row.cuir).toBeNull();
    expect(row.repositoryMode).toBe("sandbox");
    expect(row.nationalState).toBe("repository_submitted");
  });

  it("state machine refuses cuir_assigned in sandbox mode even with an official-shaped value", () => {
    const t = transitionNationalRx("repository_submission_pending", "cuir_assigned", {
      cuir: TEST_OFFICIAL_SHAPED_CUIR,
      repositoryMode: "sandbox",
    });
    expect(t.ok).toBe(false);
  });

  it("sandbox responses carrying a cuir field are rejected", () => {
    expect(() =>
      assertValidProviderResponse({
        mode: "sandbox",
        providerId: "sandbox",
        repositoryPrescriptionId: "x",
        providerRequestId: null,
        status: "registered",
        sandboxReference: "SBX-RNPD-ABC",
        cuir: TEST_OFFICIAL_SHAPED_CUIR,
      } as never)
    ).toThrow(RepositoryProviderError);
  });

  it("sandbox repository is blocked in production", () => {
    const cfg = resolveRepositoryConfig({ RENAPDIS_REPOSITORY_PROVIDER: "sandbox", VERCEL_ENV: "production" });
    expect(cfg.configured).toBe(false);
    expect(cfg.reason).toBe("sandbox_blocked_in_production");
    expect(resolveRepositoryProvider(cfg).mode).toBe("not_configured");
  });
});

describe("F — duplicate / concurrent submission", () => {
  it("concurrent submits make exactly one provider call", async () => {
    const h = createHarness({});
    const actor = { clinicId: CLINIC_A, userId: USER };
    const [a, b] = await Promise.all([
      submitNationalPrescription(actor, OPEN_GATES, RX_A, h.deps),
      submitNationalPrescription(actor, OPEN_GATES, RX_A, h.deps),
    ]);
    expect(h.providerCalls()).toBe(1);
    const codes = [a, b].map((r) => (r.ok ? r.outcome : r.code)).sort();
    expect(codes).toEqual(["in_progress", "registered_sandbox"]);
  });

  it("a second submit after success is idempotent (already_registered, no provider call)", async () => {
    const h = createHarness({});
    const actor = { clinicId: CLINIC_A, userId: USER };
    const first = await submitNationalPrescription(actor, OPEN_GATES, RX_A, h.deps);
    const second = await submitNationalPrescription(actor, OPEN_GATES, RX_A, h.deps);
    expect(h.providerCalls()).toBe(1);
    expect(second).toMatchObject({ ok: true, outcome: "already_registered" });
    if (first.ok && second.ok) expect(second.sandboxReference).toBe(first.sandboxReference);
  });

  it("retry after unavailability reuses the same idempotency key", async () => {
    let fail = true;
    const h = createHarness({
      provider: externalProvider(async () => {
        if (fail) throw new RepositoryProviderError("provider_unavailable");
        return { cuir: null };
      }),
      config: EXTERNAL_CONFIG,
      validation: OFFICIAL_VALID,
    });
    const actor = { clinicId: CLINIC_A, userId: USER };
    await submitNationalPrescription(actor, OPEN_GATES, RX_A, h.deps);
    const key = h.rows.get(RX_A)!.idempotencyKey;
    expect(key).toMatch(new RegExp(`^nrx:${CLINIC_A}:${RX_A}:`));
    fail = false;
    const retry = await submitNationalPrescription(actor, OPEN_GATES, RX_A, h.deps);
    expect(retry).toMatchObject({ ok: true, outcome: "registered" });
    expect(h.rows.get(RX_A)!.idempotencyKey).toBe(key);
    expect(h.rows.get(RX_A)!.attempts).toBe(2);
  });

  it("sandbox reference is deterministic per idempotency key", async () => {
    const p = createSandboxRepositoryProvider();
    const req = fakeRequest(baseRecord(RX_A, CLINIC_A), "sub-1", "EST");
    const ctx = { idempotencyKey: "nrx:x:y:z", correlationId: "c1", timeoutMs: 1000 };
    const a = await p.submitPrescription(req, ctx);
    const b = await p.submitPrescription(req, { ...ctx, correlationId: "c2" });
    expect(a.mode === "sandbox" && b.mode === "sandbox" && a.sandboxReference === b.sandboxReference).toBe(true);
  });
});

describe("G — clinic isolation", () => {
  it("clinic B cannot submit, cancel or read clinic A's prescription", async () => {
    const h = createHarness({ records: [baseRecord(RX_A, CLINIC_A), baseRecord(RX_B, CLINIC_B)] });
    const actorB = { clinicId: CLINIC_B, userId: USER };
    const submit = await submitNationalPrescription(actorB, OPEN_GATES, RX_A, h.deps);
    expect(submit).toMatchObject({ ok: false, code: "not_found" });
    const cancel = await cancelNationalPrescription(actorB, OPEN_GATES, RX_A, "error_emision", h.deps);
    expect(cancel).toMatchObject({ ok: false, code: "not_found" });
    expect(h.rows.get(RX_A)?.nationalState).toBeNull();
    expect(h.providerCalls()).toBe(0);
  });

  it("idempotency keys are namespaced by clinic", async () => {
    const h = createHarness({ records: [baseRecord(RX_A, CLINIC_A), baseRecord(RX_B, CLINIC_B)] });
    await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    await submitNationalPrescription({ clinicId: CLINIC_B, userId: USER }, OPEN_GATES, RX_B, h.deps);
    expect(h.rows.get(RX_A)!.idempotencyKey).toContain(CLINIC_A);
    expect(h.rows.get(RX_B)!.idempotencyKey).toContain(CLINIC_B);
  });
});

describe("H — gates cannot be bypassed by the feature flag", () => {
  const cases: Array<[keyof NationalRxGates, unknown, string]> = [
    ["hasPermission", false, "permission_denied"],
    ["productEntitled", false, "plan_not_entitled"],
    ["mfaElevated", false, "mfa_required"],
    ["establishmentCode", null, "establishment_missing"],
  ];
  for (const [gate, value, code] of cases) {
    it(`${gate} blocks even with the feature enabled`, async () => {
      const h = createHarness({});
      const result = await submitNationalPrescription(
        { clinicId: CLINIC_A, userId: USER },
        { ...OPEN_GATES, [gate]: value },
        RX_A,
        h.deps
      );
      expect(result).toMatchObject({ ok: false, code });
      expect(h.providerCalls()).toBe(0);
      expect(h.validationCalls()).toBe(0);
    });
  }

  it("non-issued (draft) prescriptions are never submitted", async () => {
    const h = createHarness({ records: [{ ...baseRecord(RX_A, CLINIC_A), status: "draft" }] });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result).toMatchObject({ ok: false, code: "not_issued" });
  });
});

describe("I — unknown provider fails closed", () => {
  it("unregistered provider ids resolve to not_configured", () => {
    const cfg = resolveRepositoryConfig({
      RENAPDIS_REPOSITORY_PROVIDER: "some-vendor",
      RENAPDIS_REPOSITORY_API_URL: "https://vendor.test.invalid",
      RENAPDIS_REPOSITORY_AUTH_MODE: "api_key",
      RENAPDIS_REPOSITORY_CLIENT_SECRET: "placeholder",
    });
    expect(cfg.configured).toBe(false);
    expect(cfg.reason).toBe("adapter_not_registered");
    expect(resolveRepositoryProvider(cfg).mode).toBe("not_configured");
  });

  it("orchestrator blocks with unknown_provider and makes no calls", async () => {
    const cfg = resolveRepositoryConfig({ RENAPDIS_REPOSITORY_PROVIDER: "some-vendor" });
    const h = createHarness({ provider: resolveRepositoryProvider(cfg), config: cfg });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result).toMatchObject({ ok: false, code: "unknown_provider" });
    expect(h.validationCalls()).toBe(0);
    expect(h.rows.get(RX_A)?.nationalState).toBeNull();
  });

  it("unset provider is not_configured", async () => {
    const cfg = resolveRepositoryConfig({});
    expect(cfg.reason).toBe("unset");
    const provider = createNotConfiguredProvider("not_configured");
    await expect(
      provider.submitPrescription(fakeRequest(baseRecord(RX_A, CLINIC_A), "s", "E"), {
        idempotencyKey: "k",
        correlationId: "c",
        timeoutMs: 1000,
      })
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("J — missing credentials fail closed", () => {
  it("orchestrator blocks with missing_credentials", async () => {
    const cfg: RepositoryConfig = { ...EXTERNAL_CONFIG, configured: false, mode: "not_configured", reason: "missing_credentials", missing: ["RENAPDIS_REPOSITORY_CLIENT_SECRET"] };
    const h = createHarness({ provider: createNotConfiguredProvider("missing_credentials"), config: cfg });
    const result = await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    expect(result).toMatchObject({ ok: false, code: "missing_credentials" });
    expect(h.providerCalls()).toBe(0);
  });

  it("the external transport refuses to build without a configured external config", () => {
    const adapter = { id: "x" } as unknown as ExternalRepositoryAdapter;
    expect(() =>
      createExternalRepositoryProvider(
        adapter,
        { ...EXTERNAL_CONFIG, configured: false, mode: "not_configured", reason: "missing_credentials" },
        { credentials: { getAuthHeaders: async () => ({}) } }
      )
    ).toThrow(RepositoryProviderError);
  });

  it("config reports missing env var NAMES only, never values", () => {
    const cfg = resolveRepositoryConfig({
      RENAPDIS_REPOSITORY_PROVIDER: "vendor",
      RENAPDIS_REPOSITORY_AUTH_MODE: "oauth2_client_credentials",
      RENAPDIS_REPOSITORY_CLIENT_ID: "placeholder-id",
    });
    expect(cfg.missing).toEqual(
      expect.arrayContaining(["RENAPDIS_REPOSITORY_API_URL", "RENAPDIS_REPOSITORY_CLIENT_SECRET", "RENAPDIS_REPOSITORY_TOKEN_URL"])
    );
    expect(JSON.stringify(cfg)).not.toContain("placeholder-id");
  });
});

describe("state machine, retries and taxonomy", () => {
  it("cancelled is terminal", () => {
    for (const to of NATIONAL_RX_STATES) expect(transitionNationalRx("cancelled", to).ok).toBe(false);
  });

  it("cannot skip professional validation", () => {
    expect(transitionNationalRx("issued_local", "repository_submission_pending").ok).toBe(false);
    expect(transitionNationalRx("professional_validation_failed", "repository_submission_pending").ok).toBe(false);
  });

  it("retryable taxonomy", () => {
    expect(isRetryableRepositoryError("network_timeout")).toBe(true);
    expect(isRetryableRepositoryError("rate_limited")).toBe(true);
    expect(isRetryableRepositoryError("invalid_patient")).toBe(false);
    expect(isRetryableRepositoryError("unauthorized")).toBe(false);
    expect(classifyHttpStatus(429)).toBe("rate_limited");
    expect(classifyHttpStatus(503)).toBe("provider_unavailable");
    expect(classifyHttpStatus(401)).toBe("unauthorized");
  });

  it("backoff is bounded and retries are capped at 5", async () => {
    const policy = { maxAttempts: 50, baseDelayMs: 100, maxDelayMs: 1000 };
    expect(computeBackoffDelay(10, policy, () => 1)).toBeLessThanOrEqual(1000);
    let calls = 0;
    await expect(
      withRepositoryRetry(
        async () => {
          calls += 1;
          throw new RepositoryProviderError("network_timeout");
        },
        policy,
        { sleep: async () => {} }
      )
    ).rejects.toMatchObject({ code: "network_timeout" });
    expect(calls).toBe(5);
  });

  it("audit metadata contains no PHI keys", async () => {
    const h = createHarness({});
    await submitNationalPrescription({ clinicId: CLINIC_A, userId: USER }, OPEN_GATES, RX_A, h.deps);
    const serialized = JSON.stringify(h.audits);
    expect(h.audits.length).toBeGreaterThan(0);
    expect(serialized).not.toMatch(/Paracetamol|00000002|Paciente|posology|documentNumber|diagnosis/);
  });
});

describe("readiness", () => {
  it("is never READY for national prescription without official credentials + homologation", () => {
    const r = evaluateNationalRxReadiness({
      featureEnabled: true,
      productEntitled: true,
      establishmentCode: "EST",
      env: { RENAPDIS_REPOSITORY_PROVIDER: "sandbox", REFEPS_VALIDATION_MODE: "sandbox", RENAPDIS_HOMOLOGATION_CONFIRMED: "true" },
    });
    expect(r.readyForNationalPrescription).toBe(false);
    expect(r.readyForSandboxTesting).toBe(true);
    expect(r.officialCuirAvailable).toBe(false);
  });

  it("official REFEPS vars alone do not make REFEPS official", () => {
    const c = resolveRefepsValidationConfig({ REFEPS_API_URL: "https://x.test.invalid", REFEPS_API_KEY: "placeholder" });
    expect(c.mode).toBe("unavailable");
    expect(c.usingLegacyVars).toBe(true);
  });
});

describe("migration + code static checks", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260929120000_national_eprescription_repository.sql"),
    "utf8"
  );
  const rollback = readFileSync(
    resolve(process.cwd(), "supabase/migrations/rollback/20260929120000_national_eprescription_repository.down.sql"),
    "utf8"
  );

  it("keeps CUIR and sandbox reference separate and protected", () => {
    expect(migration).toMatch(/sandbox_reference/);
    expect(migration).toMatch(/\^\[0-9\]\{17,41\}\$/);
    expect(migration).toMatch(/trg_guard_national_rx_columns/);
    expect(migration).toMatch(/national_rx_is_server_writer/);
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/i);
    expect(migration).toMatch(/'national_electronic_prescription'.*false/);
  });

  it("has a rollback that removes everything it adds", () => {
    expect(rollback).toMatch(/drop trigger if exists trg_guard_national_rx_columns/i);
    expect(rollback).toMatch(/drop column if exists cuir/i);
    expect(rollback).toMatch(/national_electronic_prescription/);
  });

  it("no provider secrets are exposed through NEXT_PUBLIC variables", () => {
    const files = [
      "src/core/renapdis/repository/repository-config.ts",
      "src/core/refeps/professional-validation.ts",
      "src/core/renapdis/national-prescription/national-prescription.server.ts",
      "src/features/recetas/components/recetas/national-prescription-panel.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/NEXT_PUBLIC_(REFEPS|RENAPDIS)/);
    }
    const panel = readFileSync(resolve(process.cwd(), files[3]), "utf8");
    expect(panel).not.toMatch(/process\.env/);
  });

  it("the server module is server-only and there is no hardcoded official endpoint", () => {
    const server = readFileSync(
      resolve(process.cwd(), "src/core/renapdis/national-prescription/national-prescription.server.ts"),
      "utf8"
    );
    expect(server).toMatch(/import "server-only"/);
    const external = readFileSync(resolve(process.cwd(), "src/core/renapdis/providers/external.ts"), "utf8");
    expect(external).not.toMatch(/https?:\/\/[a-z0-9.-]+\.(gob|gov)\.ar/i);
  });
});
