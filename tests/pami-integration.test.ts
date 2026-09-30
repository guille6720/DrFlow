// @vitest-environment node
import { readdirSync, readFileSync } from "fs";
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
      cuil: "20-12345678-3",
      birth_date: "1950-06-14",
      sex: "M",
      insurance_provider: "PAMI",
      insurance_number: "150123456789",
    },
  },
  [PATIENT_B]: {
    clinic_id: CLINIC_B,
    row: {
      first_name: "Ana",
      last_name: "Gómez",
      document_type: "DNI",
      document_number: "87654321",
      cuil: null,
      birth_date: "1990-01-02",
      sex: "F",
      insurance_provider: "OSDE",
      insurance_number: "999",
    },
  },
};

const ALL_ON = {
  pami_integration: true,
  pami_prescriptions: true,
  pami_medical_orders: true,
  rcta_integration: true,
  rcta_prescriptions: true,
  rcta_medical_orders: true,
};

const state = {
  clinicId: CLINIC_A as string | null,
  user: { id: "user-1" } as { id: string } | null,
  role: "doctor" as string,
  isSuperadmin: false,
  overrides: {} as Record<string, boolean>,
  features: { ...ALL_ON } as Record<string, boolean>,
  productClinic: true,
  patientQueries: 0,
  selected: "",
};

vi.mock("server-only", () => ({}));

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
        select: (cols: string) => {
          state.selected = cols;
          return q;
        },
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

import { GET as pamiRoute } from "@/app/api/pami/launch-context/route";
import { hasAnyPamiAccess, PAMI_FEATURE_KEYS, resolvePamiAccess } from "@/lib/integrations/pami/access";
import {
  createExternalPamiIntegration,
  getPamiLaunchUrl,
  openPamiMedicalOrder,
  openPamiPrescription,
} from "@/lib/integrations/pami/client";
import {
  PAMI_DEFAULT_OME_URL,
  PAMI_DEFAULT_PRESCRIPTION_URL,
  PAMI_LINK_REL,
  PAMI_LINK_TARGET,
  PAMI_OME_URL,
  PAMI_PRESCRIPTION_URL,
  resolvePamiUrl,
} from "@/lib/integrations/pami/config";
import { canonicalCoverageKey, isCanonicalPamiCoverage } from "@/lib/integrations/pami/coverage";
import { loadPamiLaunchContext } from "@/lib/integrations/pami/launch-context.server";
import { buildPamiPatientContext, formatCuil, formatPamiPatientClipboard } from "@/lib/integrations/pami/patient-context";
import { loadRctaLaunchContext } from "@/lib/integrations/rcta/launch-context.server";

beforeEach(() => {
  state.clinicId = CLINIC_A;
  state.user = { id: "user-1" };
  state.role = "doctor";
  state.isSuperadmin = false;
  state.overrides = {};
  state.features = { ...ALL_ON };
  state.productClinic = true;
  state.patientQueries = 0;
  state.selected = "";
});

describe("PAMI config", () => {
  it("uses the official PAMI entry pages by default", () => {
    expect(PAMI_DEFAULT_PRESCRIPTION_URL).toBe("https://prestadores.pami.org.ar/receta-electronica.php");
    expect(PAMI_DEFAULT_OME_URL).toBe("https://prestadores.pami.org.ar/ome.php");
    expect(PAMI_PRESCRIPTION_URL).toBe(PAMI_DEFAULT_PRESCRIPTION_URL);
    expect(PAMI_OME_URL).toBe(PAMI_DEFAULT_OME_URL);
    expect(PAMI_LINK_TARGET).toBe("_blank");
    expect(PAMI_LINK_REL).toBe("noopener noreferrer");
  });

  it("accepts an official https PAMI override (future deep link)", () => {
    expect(resolvePamiUrl("https://prestadores.pami.org.ar/nueva-receta.php", "x")).toBe(
      "https://prestadores.pami.org.ar/nueva-receta.php"
    );
    expect(resolvePamiUrl("https://pami.org.ar/ome", "x")).toBe("https://pami.org.ar/ome");
  });

  it.each([
    "http://prestadores.pami.org.ar/ome.php",
    "https://pami.org.ar.evil.com/ome.php",
    "https://evilpami.org.ar/ome.php",
    "https://example.com/ome.php",
    "https://prestadores.pami.org.ar/ome.php?dni=12345678",
    "https://prestadores.pami.org.ar/ome.php#p=1",
    "https://user:pass@prestadores.pami.org.ar/ome.php",
    "https://prestadores.pami.org.ar:8443/ome.php",
    "javascript:alert(1)",
    "not a url",
    "   ",
  ])("rejects unsafe URL %s and falls back to the default", (raw) => {
    expect(resolvePamiUrl(raw, PAMI_DEFAULT_OME_URL)).toBe(PAMI_DEFAULT_OME_URL);
  });
});

describe("D/E/G — PAMI client", () => {
  it("launches only the configured URL, in a new tab, without patient data", () => {
    const open = vi.fn();
    openPamiPrescription(open);
    openPamiMedicalOrder(open);
    expect(open).toHaveBeenNthCalledWith(1, PAMI_DEFAULT_PRESCRIPTION_URL, "_blank", "noopener,noreferrer");
    expect(open).toHaveBeenNthCalledWith(2, PAMI_DEFAULT_OME_URL, "_blank", "noopener,noreferrer");
    const integration = createExternalPamiIntegration(open);
    expect(integration.mode).toBe("external_link");
    expect(integration.openPrescription.length).toBe(0);
    expect(integration.openMedicalOrder.length).toBe(0);
  });

  it("getPamiLaunchUrl never carries query parameters", () => {
    for (const url of [getPamiLaunchUrl("prescription"), getPamiLaunchUrl("medical_order")]) {
      expect(new URL(url).search).toBe("");
      expect(url).not.toMatch(/[?&](p|dni|affiliate|patient|cuil)=/);
    }
  });
});

describe("access resolution (existing RBAC AND plan AND customization)", () => {
  const input = {
    canIssuePrescriptions: true,
    canIssueMedicalOrders: true,
    productEntitled: true,
    features: { integration: true, prescriptions: true, medicalOrders: true },
  };

  it("grants only what RBAC already grants", () => {
    expect(resolvePamiAccess(input)).toEqual({ prescriptions: true, medicalOrders: true });
    expect(resolvePamiAccess({ ...input, canIssuePrescriptions: false })).toEqual({
      prescriptions: false,
      medicalOrders: true,
    });
    expect(resolvePamiAccess({ ...input, productEntitled: false })).toEqual({
      prescriptions: false,
      medicalOrders: false,
    });
  });

  it("I/J/K — customization flags only restrict", () => {
    const off = (f: Partial<typeof input.features>) => resolvePamiAccess({ ...input, features: { ...input.features, ...f } });
    expect(off({ integration: false })).toEqual({ prescriptions: false, medicalOrders: false });
    expect(off({ prescriptions: false })).toEqual({ prescriptions: false, medicalOrders: true });
    expect(off({ medicalOrders: false })).toEqual({ prescriptions: true, medicalOrders: false });
    expect(
      resolvePamiAccess({ ...input, canIssuePrescriptions: false, canIssueMedicalOrders: false })
    ).toEqual({ prescriptions: false, medicalOrders: false });
    expect(hasAnyPamiAccess({ prescriptions: false, medicalOrders: false })).toBe(false);
  });

  it("registry defaults are ON and customizable by clinic and user", () => {
    for (const key of Object.values(PAMI_FEATURE_KEYS)) {
      const def = FEATURE_CUSTOMIZATION_REGISTRY[key];
      expect(def.defaultEnabled, key).toBe(true);
      expect(def.configurableByClinic, key).toBe(true);
      expect(def.configurableByUser, key).toBe(true);
    }
  });
});

describe("N — canonical PAMI coverage detection", () => {
  it.each(["PAMI", "pami", " Pami ", "PAMI - INSSJP", "INSSJP", "Instituto Nacional de Servicios Sociales para Jubilados y Pensionados", "PAMÍ"])(
    "detects %s",
    (value) => {
      expect(canonicalCoverageKey(value)).toBe("PAMI");
      expect(isCanonicalPamiCoverage(value)).toBe(true);
    }
  );

  it.each([null, undefined, "", "OSDE", "Particular", "PAMIRA Salud", "Swiss Medical", "IOMA"])(
    "does not detect %s",
    (value) => {
      expect(isCanonicalPamiCoverage(value)).toBe(false);
    }
  );
});

describe("patient context + clipboard", () => {
  it("formats CUIL and flags PAMI coverage", () => {
    expect(formatCuil("20123456783")).toBe("20-12345678-3");
    expect(formatCuil("20-12345678-3")).toBe("20-12345678-3");
    expect(formatCuil(null)).toBeNull();
    const ctx = buildPamiPatientContext(PATIENTS[PATIENT_A]!.row as never);
    expect(ctx.cuil).toBe("20123456783");
    expect(ctx.cuilFormatted).toBe("20-12345678-3");
    expect(ctx.pamiCoverage).toBe(true);
    expect(formatPamiPatientClipboard(ctx)).toContain("Cobertura: PAMI\nN° afiliado: 150123456789");
  });
});

describe("server-side launch context — authorization and isolation", () => {
  it("A/B — authorized doctor gets both PAMI actions for own-clinic patient", async () => {
    const res = await loadPamiLaunchContext(PATIENT_A);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.access).toEqual({ prescriptions: true, medicalOrders: true });
      expect(res.prescriptionUrl).toBe(PAMI_DEFAULT_PRESCRIPTION_URL);
      expect(res.medicalOrderUrl).toBe(PAMI_DEFAULT_OME_URL);
      expect(res.patient.pamiCoverage).toBe(true);
      for (const url of [res.prescriptionUrl, res.medicalOrderUrl]) {
        expect(url).not.toMatch(/12345678|Juan|P%C3%A9rez|150123456789|\?/);
      }
    }
    expect(state.selected).not.toMatch(/notes|diagnos|medication|password|token/i);
  });

  it("C — secretary (no clinical permission) gets nothing and no patient query runs", async () => {
    state.role = "secretary";
    expect(await loadPamiLaunchContext(PATIENT_A)).toEqual({ ok: false, reason: "not_allowed" });
    expect(state.patientQueries).toBe(0);
  });

  it("C — per-user override revoking prescriptions removes only Receta PAMI", async () => {
    state.overrides = { issuePrescriptions: false };
    const res = await loadPamiLaunchContext(PATIENT_A);
    expect(res.ok && res.access).toEqual({ prescriptions: false, medicalOrders: true });
  });

  it("I — pami_integration disabled hides both actions", async () => {
    state.features.pami_integration = false;
    expect(await loadPamiLaunchContext(PATIENT_A)).toEqual({ ok: false, reason: "not_allowed" });
    expect(state.patientQueries).toBe(0);
  });

  it("J — pami_prescriptions disabled hides only Prescription", async () => {
    state.features.pami_prescriptions = false;
    const res = await loadPamiLaunchContext(PATIENT_A);
    expect(res.ok && res.access).toEqual({ prescriptions: false, medicalOrders: true });
  });

  it("K — pami_medical_orders disabled hides only OME", async () => {
    state.features.pami_medical_orders = false;
    const res = await loadPamiLaunchContext(PATIENT_A);
    expect(res.ok && res.access).toEqual({ prescriptions: true, medicalOrders: false });
  });

  it("L — PAMI flags do not affect RCTA and vice versa", async () => {
    state.features.pami_integration = false;
    const rcta = await loadRctaLaunchContext(PATIENT_A);
    expect(rcta.ok && rcta.access).toEqual({ prescriptions: true, medicalOrders: true });
    state.features = { ...ALL_ON, rcta_integration: false };
    const pami = await loadPamiLaunchContext(PATIENT_A);
    expect(pami.ok && pami.access).toEqual({ prescriptions: true, medicalOrders: true });
  });

  it("M — clinic A cannot obtain clinic B patient information", async () => {
    expect(await loadPamiLaunchContext(PATIENT_B)).toEqual({ ok: false, reason: "not_found" });
  });

  it("unauthenticated user / no active clinic / malformed id get nothing", async () => {
    state.user = null;
    expect(await loadPamiLaunchContext(PATIENT_A)).toEqual({ ok: false, reason: "unauthenticated" });
    state.user = { id: "user-1" };
    state.clinicId = null;
    expect(await loadPamiLaunchContext(PATIENT_A)).toEqual({ ok: false, reason: "unauthenticated" });
    state.clinicId = CLINIC_A;
    expect(await loadPamiLaunchContext("../etc")).toEqual({ ok: false, reason: "invalid_patient" });
    expect(state.patientQueries).toBe(0);
  });
});

describe("GET /api/pami/launch-context", () => {
  const call = (patientId: string) =>
    pamiRoute(new Request(`https://staging.test/api/pami/launch-context?patientId=${patientId}`));

  it("returns the context without caching, 401 unauthenticated, not_found across clinics", async () => {
    const ok = await call(PATIENT_A);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toContain("no-store");
    expect((await ok.json()).ok).toBe(true);
    expect(await (await call(PATIENT_B)).json()).toEqual({ ok: false, reason: "not_found" });
    state.user = null;
    expect((await call(PATIENT_A)).status).toBe(401);
  });
});

describe("static security checks", () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
  const LIB = "src/lib/integrations/pami";
  const UI = "src/features/pacientes/components/pacientes/clinical-integrations";
  const files = [
    ...readdirSync(resolve(process.cwd(), LIB)).map((f) => `${LIB}/${f}`),
    ...readdirSync(resolve(process.cwd(), UI)).map((f) => `${UI}/${f}`),
    "src/app/api/pami/launch-context/route.ts",
  ];
  const FETCHER = `${UI}/integration-context-fetch.ts`;

  it("no browser storage, cookies, logging, analytics or fetch to PAMI", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/localStorage|sessionStorage|document\.cookie|console\.|posthog|gtag|analytics|track\(/);
      if (f !== FETCHER) expect(src, f).not.toMatch(/fetch\(/);
    }
    const src = read(FETCHER);
    expect([...src.matchAll(/fetch\(/g)]).toHaveLength(1);
    const paths = [...src.matchAll(/fetchContext<\w+>\(`([^`?]*)\?/g)].map((m) => m[1]);
    expect(paths).toEqual(["/api/rcta/launch-context", "/api/pami/launch-context"]);
    for (const f of files.filter((x) => x.startsWith(UI))) expect(read(f), f).not.toMatch(/pami\.org\.ar/);
  });

  it("H — no credential, password, OTP or token fields/handling", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(
        /type=["']password["']|<input|<form|<textarea|autoComplete=["'](one-time-code|current-password|username)["']|NEXT_PUBLIC_PAMI_(USER|PASS|TOKEN|SECRET|KEY|OTP)/i
      );
      expect(src, f).not.toMatch(/\b(pamiPassword|pamiUser|otpCode|cupToken|pamiToken|pamiCookie)\b/);
    }
  });

  it("the PAMI URLs are defined in a single place and no undocumented CUP routes exist", () => {
    const occurrences = files.filter((f) => read(f).includes("pami.org.ar/"));
    expect(occurrences).toEqual([`${LIB}/config.ts`]);
    expect(read(`${LIB}/config.ts`)).not.toMatch(/cup\.pami|\/api\/|\.php\?/);
  });

  it("the launch context is server-only and loads patients scoped by clinic", () => {
    const src = read(`${LIB}/launch-context.server.ts`);
    expect(src.startsWith('import "server-only"')).toBe(true);
    expect(src).toMatch(/\.eq\("clinic_id", clinicId\)/);
  });

  it("the feature seed migration is idempotent and has a rollback", () => {
    const up = read("supabase/migrations/20260930120000_pami_integration_feature.sql");
    const down = read("supabase/migrations/rollback/20260930120000_pami_integration_feature.down.sql");
    expect(up).toMatch(/ON CONFLICT \(feature_key\) DO NOTHING/);
    for (const key of Object.values(PAMI_FEATURE_KEYS)) {
      expect(up).toContain(`'${key}'`);
      expect(down).toContain(`'${key}'`);
    }
    expect(up).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/);
  });
});
