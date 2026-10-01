import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  getClinicGeriatricsBundleDemoMessage,
  getGeriatricsDemoMessage,
} from "@/core/billing/product-pricing";
import { BRAND_CANONICAL_HOST, BRAND_NAME } from "@/core/brand/brand";

import {
  buildPrescriptionQrPayload,
  buildRefepsQrPayload,
  buildSandboxCuirQrPayload,
} from "@/features/recetas/utils/prescription-document-coverage";

import {
  downloadClinicalRecordsListPdf,
  downloadPatientsPdf,
} from "@/lib/utils/clinical-export-client";

const pdfMocks = vi.hoisted(() => ({ save: vi.fn(), text: vi.fn() }));
vi.mock("@/lib/utils/jspdf-loader", () => ({
  loadJsPdf: async () =>
    class {
      save = pdfMocks.save;
      text = pdfMocks.text;
      setFontSize() {}
      setFont() {}
      addPage() {}
      splitTextToSize(text: string) {
        return [text];
      }
    },
}));

function readSource(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("NexClinic public brand", () => {
  it("uses one product name and canonical hostname", () => {
    expect(BRAND_NAME).toBe("NexClinic");
    expect(BRAND_CANONICAL_HOST).toBe("nexclinic.opusorg.com");
    expect(readSource("README.md")).toMatch(/^# NexClinic\r?\n/);
    expect(JSON.parse(readSource("package.json")).name).toBe("nexclinic-app");
    const lock = JSON.parse(readSource("package-lock.json"));
    expect(lock.name).toBe("nexclinic-app");
    expect(lock.packages[""].name).toBe("nexclinic-app");
  });

  it("brands sales messages consistently", () => {
    for (const message of [getGeriatricsDemoMessage(), getClinicGeriatricsBundleDemoMessage()]) {
      expect(message).toContain(BRAND_NAME);
      expect(message).not.toMatch(/drflow/i);
    }
  });

  it("brands local and sandbox QR payloads without altering REFEPS payloads", () => {
    expect(
      buildPrescriptionQrPayload({
        prescriptionNumber: "TEST-RX",
        patientDocumentNumber: "TEST-DOC",
        issuedAt: "2026-10-01T12:00:00Z",
        coverageKind: "PAMI",
      })
    ).toBe("NEXCLINIC|RX|TEST-RX|TEST-DOC|2026-10-01|PAMI");
    expect(
      buildSandboxCuirQrPayload({
        cuirFormatted: "TEST-CUIR",
        prescriptionNumber: "TEST-RX",
      })
    ).toBe("NEXCLINIC|CUIR-SANDBOX|TEST-CUIR|TEST-RX");
    expect(
      buildRefepsQrPayload({
        refepsId: "REFEPS-TEST",
        prescriptionNumber: "TEST-RX",
      })
    ).toBe("REFEPS|REFEPS-TEST|TEST-RX");
  });

  it("brands downloaded patient and consultation PDFs", async () => {
    pdfMocks.save.mockClear();
    pdfMocks.text.mockClear();
    await downloadPatientsPdf([]);
    await downloadClinicalRecordsListPdf([], "SYNTHETIC TEST");
    expect(pdfMocks.save.mock.calls.map((call) => call[0])).toEqual([
      "pacientes-nexclinic.pdf",
      "consultas-clinicas-nexclinic.pdf",
    ]);
    expect(pdfMocks.text.mock.calls.map((call) => call[0])).toContain("NexClinic — Listado de pacientes");
    expect(pdfMocks.text.mock.calls.map((call) => call[0])).toContain("NexClinic — Consultas clínicas");
  });

  it("uses the public brand in the CSV filename and product notice", () => {
    const csvSource = readSource(
      "src/features/pacientes/components/pacientes/patients-import-export-hub.tsx"
    );
    expect(csvSource).toContain("pacientes-${BRAND_NAME.toLowerCase()}.csv");
    expect(csvSource).not.toContain("pacientes-drflow.csv");
    expect(readSource("src/app/(dashboard)/sin-productos/page.tsx")).toContain("equipo {BRAND_NAME}");
  });

  it("keeps stored clinical notes and session identifiers backward compatible", () => {
    expect(readSource("src/features/pacientes/utils/patient-chart-notes.ts")).toContain("DRFLOW_CHART_JSON:");
    expect(readSource("src/lib/actions/account.ts")).toContain("drflow_clinic_id");
  });
});
