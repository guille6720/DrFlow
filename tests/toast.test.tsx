import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/core/components/notifications/toast-provider";
import { toast } from "@/core/notifications/toast";
import {
  addToast,
  dismissToast,
  getToastsSnapshot,
  resetToastStoreForTests,
} from "@/core/notifications/toast-store";

describe("toast store", () => {
  beforeEach(() => {
    resetToastStoreForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetToastStoreForTests();
  });

  it("queues multiple toasts", () => {
    addToast("success", "Primero");
    addToast("info", "Segundo");

    expect(getToastsSnapshot()).toHaveLength(2);
    expect(getToastsSnapshot()[0]?.message).toBe("Primero");
    expect(getToastsSnapshot()[1]?.message).toBe("Segundo");
  });

  it("auto-dismisses after configured duration", () => {
    addToast("success", "Temporal", { duration: 3000 });
    expect(getToastsSnapshot()).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(getToastsSnapshot()).toHaveLength(0);
  });

  it("keeps persistent toasts until manual dismiss", () => {
    const id = addToast("error", "Persistente", { duration: 0 });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(getToastsSnapshot()).toHaveLength(1);
    dismissToast(id);
    expect(getToastsSnapshot()).toHaveLength(0);
  });

  it("caps visible toasts to five", () => {
    for (let i = 1; i <= 6; i += 1) {
      addToast("info", `Toast ${i}`);
    }

    const messages = getToastsSnapshot().map((item) => item.message);
    expect(messages).toEqual(["Toast 2", "Toast 3", "Toast 4", "Toast 5", "Toast 6"]);
  });
});

describe("toast API", () => {
  beforeEach(() => {
    resetToastStoreForTests();
  });

  it("exposes tone helpers with defaults", () => {
    toast.success("Guardado");
    toast.error("Falló");
    toast.info("Info");

    const messages = getToastsSnapshot().map((item) => item.message);
    expect(messages).toEqual(["Guardado", "Falló", "Info"]);
    expect(getToastsSnapshot()[1]?.duration).toBe(7000);
  });
});

describe("ToastProvider accessibility", () => {
  beforeEach(() => {
    resetToastStoreForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    resetToastStoreForTests();
  });

  it("renders region, roles, close button and manual dismiss", () => {
    const view = render(<ToastProvider />);
    expect(screen.queryByRole("region", { name: /notificaciones/i })).not.toBeInTheDocument();

    act(() => {
      toast.success("Copiado al portapapeles", { duration: 5000 });
    });
    view.rerender(<ToastProvider />);

    expect(screen.getByRole("region", { name: /notificaciones/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copiado al portapapeles");
    expect(
      screen.getByRole("button", { name: /cerrar notificación: copiado al portapapeles/i })
    ).toBeInTheDocument();

    act(() => {
      toast.error("No se pudo guardar");
    });
    view.rerender(<ToastProvider />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar");

    fireEvent.click(
      screen.getByRole("button", { name: /cerrar notificación: copiado al portapapeles/i })
    );
    expect(getToastsSnapshot()).toHaveLength(1);
  });
});
