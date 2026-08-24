import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

afterEach(() => {
  cleanup();
});

describe("Button pending UX", () => {
  it("keeps the idle label until loading starts", () => {
    render(<Button pendingLabel="Guardando...">Guardar consulta</Button>);
    expect(screen.getByRole("button", { name: "Guardar consulta" })).toBeTruthy();
  });

  it("swaps to pendingLabel, disables, and marks aria-busy on click-ready loading", () => {
    render(
      <Button loading pendingLabel="Guardando...">
        Guardar consulta
      </Button>
    );
    const button = screen.getByRole("button", { name: "Guardando..." });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("Guardar consulta")).toBeNull();
  });
});
