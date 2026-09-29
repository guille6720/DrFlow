// @vitest-environment node
import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-8222-222222222222";
const PATIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const PATIENTS: Record<string, { clinic_id: string; row: Record<string, string | null> }> = {
  [PATIENT_A]: {
    clinic_id: CLINIC_A,
    row: {
      first_name: "Juan",
      last_name: "Pérez",
      document_type: "DNI",
      document_number: "12345678",
      birth_date: "1980-06-14",
      sex: "M",
      insurance_provider: "OSDE",
      insurance_number: "123456789",
    },
  },
  [PATIENT_B]: {
    clinic_id: CLINIC_B,
    row: {
      first_name: "Ana",
      last_name: "Gómez",
      document_type: "DNI",
      document_number: "87654321",
      birth_date: "1990-01-02",
      sex: "F",
      insurance_provider: null,
      insurance_number: null,
    },
  },
};

const state = {
  clinicId: CLINIC_A as string | null,
  user: { id: "user-1" } as { id: string } | null,
  role: "doctor" as string,
  isSuperadmin: false,
  overrides: {} as Record<string, boolean>,
  features: { rcta_integration: true, rcta_prescriptions: true, rcta_medical_orders: true } as Record<string, boolean>,
  productClinic: true,
  patientQueries: 0,
};

vi.mock("@/core/auth/session.server", () => ({
  getActiveClinicId: async () => state.clinicId,
  getSession: async () => state.user,
  getPermissionContext: async () => ({
    role: state.role,
    isSuperadmin: state.isSuperadmin,
    permissionOverrides: state.overrides,
  }),
}));

vi.mock("@/core/customizations/customizations.server", () => ({
  isFeatureEnabled: async (_clinicId: string, key: string) => state.features[key] ?? false,
}));

vi.mock("@/core/products/products.server", () => ({
  loadClinicProducts: async () => ({ catalogAvailable: true, products: state.productClinic ? ["clinic"] : [] }),
}));

vi.mock("@/core/products/product-access", () => ({
  hasProduct: () => state.productClinic,
}));

vi.mock("@/core/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      expect(table).toBe("patients");
      const filters: Record<string, string> = {};
      const q = {
        select: () => q,
        eq: (col: string, val: string) => {
          filters[col] = val;
          return q;
        },
        maybeSingle: async () => {
          state.patientQueries += 1;
          const p = PATIENTS[filters.id ?? ""];
          if (!p || p.clinic_id !== filters.clinic_id) return { data: null, error: null };
          return { data: p.row, error: null };
        },
      };
      return q;
    },
  }),
}));

import { FEATURE_CUSTOMIZATION_REGISTRY } from "@/core/customizations/registry";

import { getRctaLaunchContextAction } from "@/lib/actions/rcta";
import { resolveRctaAccess } from "@/lib/integrations/rcta/access";
import { createExternalRctaIntegration, getRctaLaunchUrl } from "@/lib/integrations/rcta/client";
import {
  RCTA_DEFAULT_URL,
  RCTA_EXTERNAL_URL,
  RCTA_LINK_REL,
  RCTA_LINK_TARGET,
  resolveRctaExternalUrl,
} from "@/lib/integrations/rcta/config";
import { buildRctaPatientContext, formatRctaPatientClipboard } from "@/lib/integrations/rcta/patient-context";

beforeEach(() => {
  state.clinicId = CLINIC_A;
  state.user = { id: "user-1" };
  state.role = "doctor";
  state.isSuperadmin = false;
  state.overrides = {};
  state.features = { rcta_integration: true, rcta_prescriptions: true, rcta_medical_orders: true };
  state.productClinic = true;
  state.patientQueries = 0;
});

describe("RCTA config", () => {
  it("defaults to https://app.rcta.me/", () => {
    expect(RCTA_DEFAULT_URL).toBe("https://app.rcta.me/");
    expect(resolveRctaExternalUrl({})).toBe("https://app.rcta.me/");
    expect(RCTA_EXTERNAL_URL).toBe("https://app.rcta.me/");
  });

  it("rejects non-https URLs and URLs carrying query/fragment/credentials", () => {
    for (const bad of [
      "http://app.rcta.me/",
      "javascript:alert(1)",
      "https://app.rcta.me/?dni=12345678",
      "https://app.rcta.me/#patient",
      "https://user:pass@app.rcta.me/",
      "not a url",
    ]) {
      expect(resolveRctaExternalUrl({ NEXT_PUBLIC_RCTA_URL: bad })).toBe(RCTA_DEFAULT_URL);
    }
    expect(resolveRctaExternalUrl({ NEXT_PUBLIC_RCTA_URL: "https://staging.rcta.example/" })).toBe(
      "https://staging.rcta.example/"
    );
  });

  it("E — link attributes are _blank + noopener noreferrer", () => {
    expect(RCTA_LINK_TARGET).toBe("_blank");
    expect(RCTA_LINK_REL).toBe("noopener noreferrer");
  });
});

describe("C/D/F — launch URL", () => {
  it("prescription and medical order both open the RCTA base URL without patient data", () => {
    expect(getRctaLaunchUrl("prescription")).toBe("https://app.rcta.me/");
    expect(getRctaLaunchUrl("medical_order")).toBe("https://app.rcta.me/");
  });

  it("programmatic launcher opens a new tab with noopener,noreferrer and ignores the patient id", () => {
    const open = vi.fn();
    const rcta = createExternalRctaIntegration(open);
    rcta.openExternalPrescription(PATIENT_A);
    rcta.openExternalMedicalOrder(PATIENT_A);
    expect(open).toHaveBeenNthCalledWith(1, "https://app.rcta.me/", "_blank", "noopener,noreferrer");
    expect(open).toHaveBeenNthCalledWith(2, "https://app.rcta.me/", "_blank", "noopener,noreferrer");
    for (const call of open.mock.calls) expect(String(call[0])).not.toContain(PATIENT_A);
  });
});

describe("access resolution (existing permissions AND plan AND customization)", () => {
  const all = { integration: true, prescriptions: true, medicalOrders: true };
  it("A — authorized clinician gets both actions", () => {
    expect(
      resolveRctaAccess({ canIssuePrescriptions: true, canIssueMedicalOrders: true, productEntitled: true, features: all })
    ).toEqual({ prescriptions: true, medicalOrders: true });
  });
  it("B — without RBAC permissions nothing is granted, even with features ON", () => {
    expect(
      resolveRctaAccess({ canIssuePrescriptions: false, canIssueMedicalOrders: false, productEntitled: true, features: all })
    ).toEqual({ prescriptions: false, medicalOrders: false });
  });
  it("I — rcta_integration disabled hides everything; sub-features restrict individually", () => {
    const base = { canIssuePrescriptions: true, canIssueMedicalOrders: true, productEntitled: true };
    expect(resolveRctaAccess({ ...base, features: { ...all, integration: false } })).toEqual({
      prescriptions: false,
      medicalOrders: false,
    });
    expect(resolveRctaAccess({ ...base, features: { ...all, prescriptions: false } })).toEqual({
      prescriptions: false,
      medicalOrders: true,
    });
  });
  it("plan/product restriction removes access", () => {
    expect(
      resolveRctaAccess({ canIssuePrescriptions: true, canIssueMedicalOrders: true, productEntitled: false, features: all })
    ).toEqual({ prescriptions: false, medicalOrders: false });
  });
  it("registry defaults are ON and customizable by clinic and user (restrict-only)", () => {
    for (const key of ["rcta_integration", "rcta_prescriptions", "rcta_medical_orders"] as const) {
      const def = FEATURE_CUSTOMIZATION_REGISTRY[key];
      expect(def.defaultEnabled).toBe(true);
      expect(def.configurableByClinic).toBe(true);
      expect(def.configurableByUser).toBe(true);
    }
  });
});

describe("patient context + clipboard helper", () => {
  it("formats identification and coverage only", () => {
    const ctx = buildRctaPatientContext(PATIENTS[PATIENT_A].row as never);
    expect(ctx).toMatchObject({
      fullName: "Juan Pérez",
      documentNumber: "12345678",
      documentNumberFormatted: "12.345.678",
      birthDate: "14/06/1980",
      insuranceProvider: "OSDE",
      insuranceNumber: "123456789",
    });
  });

  it("H — clipboard block contains no clinical data", () => {
    const text = formatRctaPatientClipboard(buildRctaPatientContext(PATIENTS[PATIENT_A].row as never));
    expect(text).toBe(
      [
        "Nombre: Juan Pérez",
        "DNI: 12345678",
        "Fecha de nacimiento: 14/06/1980",
        "Sexo: Masculino",
        "Cobertura: OSDE",
        "N° afiliado: 123456789",
      ].join("\n")
    );
    expect(text).not.toMatch(/diagn|medica|nota|alerg/i);
  });

  it("omits missing fields", () => {
    const text = formatRctaPatientClipboard(buildRctaPatientContext(PATIENTS[PATIENT_B].row as never));
    expect(text).not.toContain("Cobertura");
    expect(text).not.toContain("afiliado");
  });
});

describe("server action — authorization and isolation", () => {
  it("A — authorized doctor receives launch context for own-clinic patient", async () => {
    const res = await getRctaLaunchContextAction(PATIENT_A);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.launchUrl).toBe("https://app.rcta.me/");
      expect(res.access).toEqual({ prescriptions: true, medicalOrders: true });
      expect(res.patient.fullName).toBe("Juan Pérez");
      expect(res.launchUrl).not.toMatch(/12345678|Juan|P%C3%A9rez|\?/);
    }
  });

  it("B — secretary (no clinical/prescribing permission) gets nothing and no patient query runs", async () => {
    state.role = "secretary";
    const res = await getRctaLaunchContextAction(PATIENT_A);
    expect(res).toEqual({ ok: false, reason: "not_allowed" });
    expect(state.patientQueries).toBe(0);
  });

  it("B — per-user override revoking prescribing removes the prescription action only", async () => {
    state.overrides = { issuePrescriptions: false };
    const res = await getRctaLaunchContextAction(PATIENT_A);
    expect(res.ok && res.access).toEqual({ prescriptions: false, medicalOrders: true });
  });

  it("I — rcta_integration disabled (user/clinic customization) returns not_allowed", async () => {
    state.features.rcta_integration = false;
    const res = await getRctaLaunchContextAction(PATIENT_A);
    expect(res).toEqual({ ok: false, reason: "not_allowed" });
    expect(state.patientQueries).toBe(0);
  });

  it("J — clinic A cannot load clinic B patient context", async () => {
    const res = await getRctaLaunchContextAction(PATIENT_B);
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });

  it("K — unauthenticated user / no active clinic gets nothing", async () => {
    state.user = null;
    expect(await getRctaLaunchContextAction(PATIENT_A)).toEqual({ ok: false, reason: "unauthenticated" });
    state.user = { id: "user-1" };
    state.clinicId = null;
    expect(await getRctaLaunchContextAction(PATIENT_A)).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("rejects malformed patient ids before any query", async () => {
    expect(await getRctaLaunchContextAction("../etc")).toEqual({ ok: false, reason: "invalid_patient" });
    expect(state.patientQueries).toBe(0);
  });
});

describe("static security checks", () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
  const files = [
    "src/lib/integrations/rcta/config.ts",
    "src/lib/integrations/rcta/client.ts",
    "src/lib/integrations/rcta/types.ts",
    "src/lib/integrations/rcta/access.ts",
    "src/lib/integrations/rcta/patient-context.ts",
    "src/lib/actions/rcta.ts",
    "src/features/pacientes/components/pacientes/rcta-launch-card.tsx",
  ];

  it("no localStorage/sessionStorage, console logging, analytics or fetch to RCTA", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/localStorage|sessionStorage|console\.|posthog|gtag|analytics|track\(/);
      expect(src, f).not.toMatch(/fetch\(/);
    }
  });

  it("no RCTA secrets or invented API endpoints", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/NEXT_PUBLIC_RCTA_(API|KEY|SECRET|TOKEN)/);
      expect(src, f).not.toMatch(/app\.rcta\.me\/(api|v\d)/);
    }
  });

  it("the RCTA URL is defined in a single place", () => {
    const occurrences = files.filter((f) => read(f).includes("app.rcta.me"));
    expect(occurrences).toEqual(["src/lib/integrations/rcta/config.ts"]);
  });

  it("the server action is a server module and loads patients scoped by clinic", () => {
    const src = read("src/lib/actions/rcta.ts");
    expect(src.startsWith('"use server"')).toBe(true);
    expect(src).toMatch(/\.eq\("clinic_id", clinicId\)/);
  });
});
