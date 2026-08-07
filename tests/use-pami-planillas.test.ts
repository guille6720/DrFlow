import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMedicalOrder, refreshSafely } = vi.hoisted(() => ({
  createMedicalOrder: vi.fn(),
  refreshSafely: vi.fn(),
}));

vi.mock("@/features/recetas/actions/medical-orders", () => ({
  createMedicalOrder,
}));

vi.mock("@/core/hooks/use-app-router-refresh", () => ({
  useAppRouterRefresh: () => ({ refreshSafely, isRefreshing: false }),
}));

const { toastSuccess } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/notifications/toast", () => ({
  toast: {
    success: toastSuccess,
    copySuccess: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  },
}));

import { PAMI_PLANILLA_FALLBACK_CATALOG } from "@/features/pami/seed/pami-planilla-fallback-catalog";

import { usePamiPlanillas } from "@/lib/hooks/use-pami-planillas";

const PATIENT = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  first_name: "Juan",
  last_name: "García",
  document_number: "12345678",
  insurance_number: "987654321",
  phone: null,
  address: "Calle 1",
};

const PROFESSIONAL = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  license_number: "12345",
  display_name: "Dr. Pérez",
  profiles: { full_name: "Dr. Pérez" },
};

describe("usePamiPlanillas saveAsOrder", () => {
  beforeEach(() => {
    createMedicalOrder.mockReset();
    refreshSafely.mockReset();
    toastSuccess.mockReset();
    createMedicalOrder.mockResolvedValue({
      data: { id: "order-1" },
    });
    refreshSafely.mockResolvedValue({ ok: true });
  });

  it("ignores concurrent save clicks and sends one idempotency key", async () => {
    let resolveCreate: ((value: { data: { id: string } }) => void) | undefined;
    createMedicalOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const { result } = renderHook(() =>
      usePamiPlanillas([PATIENT], [PROFESSIONAL], PAMI_PLANILLA_FALLBACK_CATALOG, PROFESSIONAL.id)
    );

    act(() => {
      result.current.setPatientId(PATIENT.id);
      result.current.setProfessionalId(PROFESSIONAL.id);
      result.current.setValues({ motivo: "EPOC", diagnostico: "J44" });
    });

    await waitFor(() => {
      expect(result.current.rendered.length).toBeGreaterThan(0);
    });

    let firstSave: Promise<void>;
    act(() => {
      firstSave = result.current.saveAsOrder();
      void result.current.saveAsOrder();
      void result.current.saveAsOrder();
    });

    expect(result.current.loading).toBe(true);
    expect(createMedicalOrder).toHaveBeenCalledTimes(1);

    const firstFormData = createMedicalOrder.mock.calls[0]![0] as FormData;
    const idempotencyKey = firstFormData.get("idempotency_key");
    expect(typeof idempotencyKey).toBe("string");
    expect(String(idempotencyKey).length).toBeGreaterThan(0);

    await act(async () => {
      resolveCreate?.({ data: { id: "order-1" } });
      await firstSave!;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("resets idempotency key after successful save so a new save gets a new key", async () => {
    const keys: string[] = [];
    createMedicalOrder.mockImplementation(async (fd: FormData) => {
      keys.push(String(fd.get("idempotency_key")));
      return { data: { id: "order-1" } };
    });

    const { result } = renderHook(() =>
      usePamiPlanillas([PATIENT], [PROFESSIONAL], PAMI_PLANILLA_FALLBACK_CATALOG, PROFESSIONAL.id)
    );

    act(() => {
      result.current.setPatientId(PATIENT.id);
      result.current.setProfessionalId(PROFESSIONAL.id);
      result.current.setValues({ motivo: "EPOC", diagnostico: "J44" });
    });

    await waitFor(() => {
      expect(result.current.rendered.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.saveAsOrder();
    });

    act(() => {
      result.current.setValues({ motivo: "EPOC 2", diagnostico: "J44" });
    });

    await waitFor(() => {
      expect(result.current.rendered).toContain("EPOC 2");
    });

    await act(async () => {
      await result.current.saveAsOrder();
    });

    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("blocks a second save while validation is running on the first attempt", async () => {
    let resolveCreate: ((value: { data: { id: string } }) => void) | undefined;
    createMedicalOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const { result } = renderHook(() =>
      usePamiPlanillas([PATIENT], [PROFESSIONAL], PAMI_PLANILLA_FALLBACK_CATALOG, PROFESSIONAL.id)
    );

    act(() => {
      result.current.setPatientId(PATIENT.id);
      result.current.setProfessionalId(PROFESSIONAL.id);
      result.current.setValues({ motivo: "EPOC", diagnostico: "J44" });
    });

    await waitFor(() => {
      expect(result.current.rendered.length).toBeGreaterThan(0);
    });

    act(() => {
      void result.current.saveAsOrder();
      void result.current.saveAsOrder();
    });

    expect(createMedicalOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate?.({ data: { id: "order-1" } });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("restores loading state when createMedicalOrder returns an error", async () => {
    createMedicalOrder.mockResolvedValue({ error: "No se pudo guardar la orden." });

    const { result } = renderHook(() =>
      usePamiPlanillas([PATIENT], [PROFESSIONAL], PAMI_PLANILLA_FALLBACK_CATALOG, PROFESSIONAL.id)
    );

    act(() => {
      result.current.setPatientId(PATIENT.id);
      result.current.setProfessionalId(PROFESSIONAL.id);
      result.current.setValues({ motivo: "EPOC", diagnostico: "J44" });
    });

    await waitFor(() => {
      expect(result.current.rendered.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.saveAsOrder();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("No se pudo guardar la orden.");
    expect(createMedicalOrder).toHaveBeenCalledTimes(1);
  });

  it("handleSaveAsOrder ignores repeated activation events while loading", async () => {
    let resolveCreate: ((value: { data: { id: string } }) => void) | undefined;
    createMedicalOrder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const { result } = renderHook(() =>
      usePamiPlanillas([PATIENT], [PROFESSIONAL], PAMI_PLANILLA_FALLBACK_CATALOG, PROFESSIONAL.id)
    );

    act(() => {
      result.current.setPatientId(PATIENT.id);
      result.current.setProfessionalId(PROFESSIONAL.id);
      result.current.setValues({ motivo: "EPOC", diagnostico: "J44" });
    });

    await waitFor(() => {
      expect(result.current.rendered.length).toBeGreaterThan(0);
    });

    const fakeEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    act(() => {
      result.current.handleSaveAsOrder(fakeEvent);
      result.current.handleSaveAsOrder(fakeEvent);
    });

    expect(createMedicalOrder).toHaveBeenCalledTimes(1);
    expect(fakeEvent.preventDefault.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(fakeEvent.stopPropagation.mock.calls.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      resolveCreate?.({ data: { id: "order-1" } });
    });
  });

  it("shows a refresh warning but preserves form state when refresh fails after save", async () => {
    refreshSafely.mockResolvedValue({
      ok: false,
      reason: "refresh_timeout",
      message:
        "La planilla se guardó correctamente, pero no pudimos actualizar la pantalla. Podés usar «Actualizar» o recargar la página.",
    });

    const { result } = renderHook(() =>
      usePamiPlanillas([PATIENT], [PROFESSIONAL], PAMI_PLANILLA_FALLBACK_CATALOG, PROFESSIONAL.id)
    );

    act(() => {
      result.current.setPatientId(PATIENT.id);
      result.current.setProfessionalId(PROFESSIONAL.id);
      result.current.setValues({ motivo: "EPOC", diagnostico: "J44" });
    });

    await waitFor(() => {
      expect(result.current.rendered.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.saveAsOrder();
    });

    expect(refreshSafely).toHaveBeenCalledWith({
      scope: "pami-planillas.refresh-after-save",
      metadata: expect.objectContaining({
        patientId: PATIENT.id,
        professionalId: PROFESSIONAL.id,
        orderType: "pami_form",
      }),
    });
    expect(toastSuccess).toHaveBeenCalledWith("Planilla guardada como orden médica");
    expect(result.current.error).toContain("no pudimos actualizar la pantalla");
    expect(result.current.values).toEqual({ motivo: "EPOC", diagnostico: "J44" });
    expect(result.current.patientId).toBe(PATIENT.id);
  });
});
