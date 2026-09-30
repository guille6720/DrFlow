import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PamiLaunchContextResult } from "@/lib/integrations/pami/types";
import type { RctaLaunchContextResult } from "@/lib/integrations/rcta/types";

const mocks = vi.hoisted(() => ({
  rcta: vi.fn<(patientId: string) => Promise<RctaLaunchContextResult>>(),
  pami: vi.fn<(patientId: string) => Promise<PamiLaunchContextResult>>(),
  copy: vi.fn(async (_text: string) => ({ ok: true as const, method: "clipboard" as const })),
  copySuccess: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/core/browser/copy-to-clipboard", () => ({ copyTextToClipboard: mocks.copy }));
vi.mock("@/core/notifications/toast", () => ({ toast: { copySuccess: mocks.copySuccess, error: mocks.error } }));

import { ClinicalIntegrationsCard } from "@/features/pacientes/components/pacientes/clinical-integrations/clinical-integrations-card";

const PATIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAMI_RX = "https://prestadores.pami.org.ar/receta-electronica.php";
const PAMI_OME = "https://prestadores.pami.org.ar/ome.php";

const basePatient = {
  fullName: "Juan Pérez",
  documentType: "DNI",
  documentNumber: "12345678",
  documentNumberFormatted: "12.345.678",
  birthDate: "14/06/1980",
  sex: "Masculino",
  insuranceProvider: "OSDE",
  insuranceNumber: "123456789",
};

const rctaAllowed = (access = { prescriptions: true, medicalOrders: true }): RctaLaunchContextResult => ({
  ok: true,
  launchUrl: "https://app.rcta.me/",
  access,
  patient: basePatient,
});

const pamiAllowed = (
  access = { prescriptions: true, medicalOrders: true },
  patient: Partial<typeof basePatient> & { pamiCoverage?: boolean } = {}
): PamiLaunchContextResult => ({
  ok: true,
  prescriptionUrl: PAMI_RX,
  medicalOrderUrl: PAMI_OME,
  access,
  patient: {
    ...basePatient,
    cuil: "20123456783",
    cuilFormatted: "20-12345678-3",
    pamiCoverage: false,
    ...patient,
  },
});

const DENIED = { ok: false as const, reason: "not_allowed" as const };

const fetchMock = vi.fn(async (input: string, _init?: RequestInit) => {
  const url = new URL(input, "https://staging.test");
  const patientId = url.searchParams.get("patientId") ?? "";
  let body: unknown;
  if (url.pathname === "/api/rcta/launch-context") body = await mocks.rcta(patientId);
  else if (url.pathname === "/api/pami/launch-context") body = await mocks.pami(patientId);
  else throw new Error(`unexpected fetch ${url.pathname}`);
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  mocks.rcta.mockReset().mockResolvedValue(rctaAllowed());
  mocks.pami.mockReset().mockResolvedValue(pamiAllowed());
  mocks.copy.mockClear();
  mocks.copySuccess.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rx = () => render(<ClinicalIntegrationsCard patientId={PATIENT_ID} section="prescriptions" />);
const orders = () => render(<ClinicalIntegrationsCard patientId={PATIENT_ID} section="medicalOrders" />);

describe("Recetas section", () => {
  it("A/L — authorized prescriber sees RCTA and Receta PAMI, plus the patient panel", async () => {
    rx();
    expect(await screen.findByText("Receta electrónica")).toBeInTheDocument();
    expect(screen.getByTestId("rcta-prescription-link")).toHaveTextContent("Nueva receta electrónica RCTA");
    expect(screen.getByTestId("pami-prescription-link")).toHaveTextContent("Receta PAMI");
    expect(screen.queryByTestId("rcta-medical-order-link")).toBeNull();
    expect(screen.queryByTestId("pami-medical-order-link")).toBeNull();
    expect(screen.getByText("12.345.678")).toBeInTheDocument();
    expect(screen.getByText("20-12345678-3")).toBeInTheDocument();
    expect(screen.getByText(/Se abrirá el sistema oficial de PAMI/)).toBeInTheDocument();
    expect(screen.getByText(/PAMI podrá reutilizarla/)).toBeInTheDocument();
    expect(mocks.rcta).toHaveBeenCalledWith(PATIENT_ID);
    expect(mocks.pami).toHaveBeenCalledWith(PATIENT_ID);
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toMatchObject({ cache: "no-store", credentials: "same-origin" });
    }
  });

  it("D/F/G — Receta PAMI opens the official URL in a new tab without patient data", async () => {
    rx();
    const link = await screen.findByTestId("pami-prescription-link");
    expect(link).toHaveAttribute("href", PAMI_RX);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const href = link.getAttribute("href") ?? "";
    expect(href).not.toMatch(/12345678|20123456783|Juan|P%C3%A9rez|123456789|\?|#/);
    expect(href).not.toContain(PATIENT_ID);
    expect(link).toHaveAccessibleName(/sistema oficial de PAMI.*nueva pestaña/);
  });

  it("C — prescriber without PAMI prescription access does not see Receta PAMI (RCTA stays)", async () => {
    mocks.pami.mockResolvedValue(pamiAllowed({ prescriptions: false, medicalOrders: true }));
    rx();
    await screen.findByTestId("rcta-prescription-link");
    expect(screen.queryByTestId("pami-prescription-link")).toBeNull();
    expect(screen.queryByText(/sistema oficial de PAMI/)).toBeNull();
  });

  it("C/I — renders nothing when neither system is allowed", async () => {
    mocks.rcta.mockResolvedValue(DENIED);
    mocks.pami.mockResolvedValue(DENIED);
    const { container } = rx();
    await waitFor(() => expect(mocks.pami).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("PAMI still available when RCTA is denied", async () => {
    mocks.rcta.mockResolvedValue(DENIED);
    rx();
    expect(await screen.findByTestId("pami-prescription-link")).toHaveAttribute("data-prioritized", "true");
    expect(screen.queryByTestId("rcta-prescription-link")).toBeNull();
  });

  it("renders RCTA only when the PAMI context request fails", async () => {
    const failingPami = vi.fn(async (input: string) => {
      if (input.startsWith("/api/pami/")) return new Response("", { status: 500 });
      return new Response(JSON.stringify(rctaAllowed()), { status: 200 });
    });
    vi.stubGlobal("fetch", failingPami);
    rx();
    expect(await screen.findByTestId("rcta-prescription-link")).toBeInTheDocument();
    expect(screen.queryByTestId("pami-prescription-link")).toBeNull();
    expect(failingPami).toHaveBeenCalledTimes(2);
  });
});

describe("Órdenes section", () => {
  it("B/L — authorized order issuer sees RCTA order and Orden PAMI / OME", async () => {
    orders();
    expect(await screen.findByText("Orden médica electrónica")).toBeInTheDocument();
    expect(screen.getByTestId("rcta-medical-order-link")).toHaveTextContent("Nueva orden médica RCTA");
    expect(screen.getByTestId("pami-medical-order-link")).toHaveTextContent("Orden PAMI / OME");
    expect(screen.queryByTestId("pami-prescription-link")).toBeNull();
  });

  it("E/F/G — Orden PAMI / OME opens the official URL in a new tab without patient data", async () => {
    orders();
    const link = await screen.findByTestId("pami-medical-order-link");
    expect(link).toHaveAttribute("href", PAMI_OME);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.getAttribute("href") ?? "").not.toMatch(/12345678|Juan|123456789|\?|#/);
  });

  it("C — user without order access does not see Orden PAMI / OME", async () => {
    mocks.pami.mockResolvedValue(pamiAllowed({ prescriptions: true, medicalOrders: false }));
    mocks.rcta.mockResolvedValue(rctaAllowed({ prescriptions: true, medicalOrders: false }));
    const { container } = orders();
    await waitFor(() => expect(mocks.pami).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("L — RCTA links keep https://app.rcta.me/, new tab and noopener noreferrer", async () => {
    orders();
    const link = await screen.findByTestId("rcta-medical-order-link");
    expect(link).toHaveAttribute("href", "https://app.rcta.me/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("PAMI coverage emphasis", () => {
  it("N — PAMI coverage shows the indicator and prioritizes PAMI without hiding RCTA", async () => {
    mocks.pami.mockResolvedValue(
      pamiAllowed(undefined, { pamiCoverage: true, insuranceProvider: "PAMI", insuranceNumber: "150123456789" })
    );
    rx();
    expect(await screen.findByTestId("pami-coverage-indicator")).toHaveTextContent("Cobertura PAMI");
    const pami = screen.getByTestId("pami-prescription-link");
    const rcta = screen.getByTestId("rcta-prescription-link");
    expect(pami).toHaveAttribute("data-prioritized", "true");
    expect(rcta).toHaveAttribute("data-prioritized", "false");
    expect(pami.compareDocumentPosition(rcta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("N° afiliado PAMI")).toBeInTheDocument();
  });

  it("non-PAMI coverage keeps RCTA first and PAMI not prioritized", async () => {
    rx();
    const rcta = await screen.findByTestId("rcta-prescription-link");
    expect(rcta).toHaveAttribute("data-prioritized", "true");
    expect(screen.getByTestId("pami-prescription-link")).toHaveAttribute("data-prioritized", "false");
    expect(screen.queryByTestId("pami-coverage-indicator")).toBeNull();
  });
});

describe("copy helpers (manual only)", () => {
  it("O — nothing is copied until the clinician clicks", async () => {
    rx();
    await screen.findByTestId("pami-prescription-link");
    expect(mocks.copy).not.toHaveBeenCalled();
  });

  it.each([
    ["Copiar DNI", "12345678"],
    ["Copiar CUIL", "20123456783"],
    ["Copiar número de afiliado", "123456789"],
  ])("%s copies the raw value and shows 'Datos copiados'", async (name, value) => {
    rx();
    fireEvent.click(await screen.findByRole("button", { name }));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith(value));
    expect(mocks.copySuccess).toHaveBeenCalledWith("Datos copiados");
  });

  it("Copiar datos del paciente copies a plain-text block without clinical data", async () => {
    mocks.pami.mockResolvedValue(pamiAllowed(undefined, { pamiCoverage: true, insuranceProvider: "PAMI" }));
    rx();
    fireEvent.click(await screen.findByRole("button", { name: /Copiar datos del paciente/ }));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledTimes(1));
    const text = mocks.copy.mock.calls[0][0];
    expect(text).toBe(
      [
        "Nombre: Juan Pérez",
        "DNI: 12345678",
        "CUIL: 20-12345678-3",
        "Fecha de nacimiento: 14/06/1980",
        "Sexo: Masculino",
        "Cobertura: PAMI",
        "N° afiliado: 123456789",
      ].join("\n")
    );
  });
});

describe("credentials and accessibility", () => {
  it("H — no credential, password or OTP inputs are rendered", async () => {
    const { container } = rx();
    await screen.findByTestId("pami-prescription-link");
    expect(container.querySelector("input, form, textarea")).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/contraseña|password|OTP|usuario CUP|token/i);
  });

  it("links and copy buttons are keyboard-focusable native controls", async () => {
    rx();
    const link = await screen.findByTestId("pami-prescription-link");
    link.focus();
    expect(document.activeElement).toBe(link);
    const copy = screen.getByRole("button", { name: "Copiar DNI" });
    expect(copy).toHaveAttribute("type", "button");
  });
});
