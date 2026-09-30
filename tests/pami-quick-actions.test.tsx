import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PamiQuickActions } from "@/features/pacientes/components/pacientes/clinical-integrations/pami-quick-actions";

import type { PamiLaunchContextResult } from "@/lib/integrations/pami/types";

const PATIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const allowed = (access = { prescriptions: true, medicalOrders: true }): PamiLaunchContextResult => ({
  ok: true,
  prescriptionUrl: "https://prestadores.pami.org.ar/receta-electronica.php",
  medicalOrderUrl: "https://prestadores.pami.org.ar/ome.php",
  access,
  patient: {
    fullName: "Juan Pérez",
    documentType: "DNI",
    documentNumber: "12345678",
    documentNumberFormatted: "12.345.678",
    birthDate: null,
    sex: null,
    insuranceProvider: "PAMI",
    insuranceNumber: null,
    cuil: null,
    cuilFormatted: null,
    pamiCoverage: true,
  },
});

let body: PamiLaunchContextResult = allowed();
const fetchMock = vi.fn(async (input: string) => {
  expect(new URL(input, "https://staging.test").pathname).toBe("/api/pami/launch-context");
  return new Response(JSON.stringify(body), { status: 200 });
});

beforeEach(() => {
  body = allowed();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PamiQuickActions (clinical history header)", () => {
  it("shows both PAMI links with the official URLs, new tab and no patient data", async () => {
    render(<PamiQuickActions patientId={PATIENT_ID} />);
    const rx = await screen.findByTestId("ehr-pami-prescription");
    const ome = screen.getByTestId("ehr-pami-medical-order");
    expect(rx).toHaveAttribute("href", "https://prestadores.pami.org.ar/receta-electronica.php");
    expect(ome).toHaveAttribute("href", "https://prestadores.pami.org.ar/ome.php");
    for (const a of [rx, ome]) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
      expect(a.getAttribute("href")).not.toMatch(/12345678|Juan|\?/);
    }
  });

  it("shows only permitted actions", async () => {
    body = allowed({ prescriptions: false, medicalOrders: true });
    render(<PamiQuickActions patientId={PATIENT_ID} />);
    await screen.findByTestId("ehr-pami-medical-order");
    expect(screen.queryByTestId("ehr-pami-prescription")).toBeNull();
  });

  it("renders nothing when not allowed", async () => {
    body = { ok: false, reason: "not_allowed" };
    const { container } = render(<PamiQuickActions patientId={PATIENT_ID} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("runs onBeforeOpen when clicked", async () => {
    const onBeforeOpen = vi.fn();
    render(<PamiQuickActions patientId={PATIENT_ID} onBeforeOpen={onBeforeOpen} />);
    const rx = await screen.findByTestId("ehr-pami-prescription");
    rx.addEventListener("click", (e) => e.preventDefault());
    rx.click();
    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
  });
});
