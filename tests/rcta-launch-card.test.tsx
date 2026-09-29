import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RctaLaunchContextResult } from "@/lib/integrations/rcta/types";

const mocks = vi.hoisted(() => ({
  action: vi.fn<(patientId: string) => Promise<RctaLaunchContextResult>>(),
  copy: vi.fn(async (_text: string) => ({ ok: true as const, method: "clipboard" as const })),
  copySuccess: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/core/browser/copy-to-clipboard", () => ({ copyTextToClipboard: mocks.copy }));
vi.mock("@/core/notifications/toast", () => ({ toast: { copySuccess: mocks.copySuccess, error: mocks.error } }));

import { RctaLaunchCard } from "@/features/pacientes/components/pacientes/rcta-launch-card";

const PATIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const allowed = (access = { prescriptions: true, medicalOrders: true }): RctaLaunchContextResult => ({
  ok: true,
  launchUrl: "https://app.rcta.me/",
  access,
  patient: {
    fullName: "Juan Pérez",
    documentType: "DNI",
    documentNumber: "12345678",
    documentNumberFormatted: "12.345.678",
    birthDate: "14/06/1980",
    sex: null,
    insuranceProvider: "OSDE",
    insuranceNumber: "123456789",
  },
});

const fetchMock = vi.fn(async (input: string, _init?: RequestInit) => {
  const url = new URL(input, "https://staging.test");
  expect(url.pathname).toBe("/api/rcta/launch-context");
  const body = await mocks.action(url.searchParams.get("patientId") ?? "");
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  mocks.action.mockReset();
  mocks.copy.mockClear();
  mocks.copySuccess.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RctaLaunchCard", () => {
  it("A — authorized clinician sees the section, both actions and the patient panel", async () => {
    mocks.action.mockResolvedValue(allowed());
    render(<RctaLaunchCard patientId={PATIENT_ID} />);
    expect(await screen.findByText("Recetas y Órdenes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Generar receta electrónica/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Generar orden médica/ })).toBeInTheDocument();
    expect(screen.getByText("12.345.678")).toBeInTheDocument();
    expect(screen.getByText("OSDE")).toBeInTheDocument();
    expect(screen.getByText(/RCTA se abrirá en una nueva pestaña/)).toBeInTheDocument();
    expect(mocks.action).toHaveBeenCalledWith(PATIENT_ID);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store", credentials: "same-origin" });
  });

  it("renders nothing when the context request fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    const { container } = render(<RctaLaunchCard patientId={PATIENT_ID} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.querySelector("[data-testid=rcta-prescription-link]")).toBeNull();
  });

  it("B/I — renders nothing when not allowed (unauthorized or feature disabled)", async () => {
    mocks.action.mockResolvedValue({ ok: false, reason: "not_allowed" });
    const { container } = render(<RctaLaunchCard patientId={PATIENT_ID} />);
    await waitFor(() => expect(mocks.action).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link", { name: /Generar/ })).toBeNull();
  });

  it("B — only permitted actions are shown", async () => {
    mocks.action.mockResolvedValue(allowed({ prescriptions: false, medicalOrders: true }));
    render(<RctaLaunchCard patientId={PATIENT_ID} />);
    await screen.findByText("Recetas y Órdenes");
    expect(screen.queryByRole("link", { name: /Generar receta electrónica/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Generar orden médica/ })).toBeInTheDocument();
  });

  it("C/D/E/F — links open https://app.rcta.me/ in a new tab, noopener noreferrer, no patient data", async () => {
    mocks.action.mockResolvedValue(allowed());
    render(<RctaLaunchCard patientId={PATIENT_ID} />);
    const links = [
      await screen.findByRole("link", { name: /Generar receta electrónica/ }),
      screen.getByRole("link", { name: /Generar orden médica/ }),
    ];
    for (const link of links) {
      expect(link).toHaveAttribute("href", "https://app.rcta.me/");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toMatch(/12345678|Juan|P%C3%A9rez|OSDE|123456789|\?|#/);
      expect(href).not.toContain(PATIENT_ID);
    }
  });

  it("G — Copiar DNI copies the raw document number and shows 'Datos copiados'", async () => {
    mocks.action.mockResolvedValue(allowed());
    render(<RctaLaunchCard patientId={PATIENT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copiar DNI" }));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith("12345678"));
    expect(mocks.copySuccess).toHaveBeenCalledWith("Datos copiados");
  });

  it("copies the affiliate number", async () => {
    mocks.action.mockResolvedValue(allowed());
    render(<RctaLaunchCard patientId={PATIENT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copiar número de afiliado" }));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith("123456789"));
  });

  it("H — Copiar datos del paciente copies a plain-text block without clinical data", async () => {
    mocks.action.mockResolvedValue(allowed());
    render(<RctaLaunchCard patientId={PATIENT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: /Copiar datos del paciente/ }));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledTimes(1));
    const text = mocks.copy.mock.calls[0][0];
    expect(text).toContain("Nombre: Juan Pérez");
    expect(text).toContain("DNI: 12345678");
    expect(text).toContain("Fecha de nacimiento: 14/06/1980");
    expect(text).toContain("Cobertura: OSDE");
    expect(text).toContain("N° afiliado: 123456789");
    expect(mocks.copySuccess).toHaveBeenCalledWith("Datos copiados");
  });

  it("is keyboard reachable: links and copy buttons are focusable native controls", async () => {
    mocks.action.mockResolvedValue(allowed());
    render(<RctaLaunchCard patientId={PATIENT_ID} />);
    const link = await screen.findByRole("link", { name: /Generar receta electrónica/ });
    link.focus();
    expect(document.activeElement).toBe(link);
    const copy = screen.getByRole("button", { name: "Copiar DNI" });
    expect(copy.tagName).toBe("BUTTON");
    expect(copy).toHaveAttribute("type", "button");
  });
});
