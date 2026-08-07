import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { configurePamiCabecera, refresh } = vi.hoisted(() => ({
  configurePamiCabecera: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/actions/pami-setup", () => ({
  configurePamiCabecera,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { PamiSetupPanel } from "@/features/configuracion/components/configuracion/pami-setup-panel";

function renderPanel(practiceProfile: string | null = null) {
  return render(
    <PamiSetupPanel practiceProfile={practiceProfile} defaultInsurance="PAMI" />
  );
}

function getSetupButton() {
  return screen.getByRole("button", { name: /activar consultorio pami cabecera/i });
}

describe("PamiSetupPanel handleSetup", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    configurePamiCabecera.mockReset();
    refresh.mockReset();
  });

  it("ignores concurrent clicks and calls configurePamiCabecera once", async () => {
    let resolveSetup:
      | ((value: { success?: boolean; message?: string; error?: string }) => void)
      | undefined;

    configurePamiCabecera.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSetup = resolve;
        })
    );

    renderPanel();

    const button = getSetupButton();
    expect(button).not.toBeDisabled();

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    expect(configurePamiCabecera).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSetup?.({ success: true, message: "Perfil PAMI listo." });
    });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Perfil PAMI listo.")).toBeInTheDocument();
  });

  it("restores loading state and shows error when the action fails", async () => {
    configurePamiCabecera.mockResolvedValue({ error: "La clínica activa no existe." });

    renderPanel();

    const button = getSetupButton();

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    expect(configurePamiCabecera).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText("La clínica activa no existe.")).toBeInTheDocument();
  });

  it("restores loading state when configurePamiCabecera throws", async () => {
    configurePamiCabecera.mockRejectedValue(new Error("network"));

    renderPanel();

    const button = getSetupButton();

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    expect(configurePamiCabecera).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("No se pudo configurar el perfil PAMI. Intentá de nuevo.")
    ).toBeInTheDocument();
  });

  it("allows a second click after the first request completes", async () => {
    configurePamiCabecera
      .mockResolvedValueOnce({ success: true, message: "Primera vez" })
      .mockResolvedValueOnce({ success: true, message: "Segunda vez" });

    renderPanel("cabecera_pami");

    const button = screen.getByRole("button", { name: /actualizar perfil pami/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText("Primera vez")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText("Segunda vez")).toBeInTheDocument();
    });

    expect(configurePamiCabecera).toHaveBeenCalledTimes(2);
  });
});
