import { describe, expect, it } from "vitest";

describe("patient order sheet post-create preview", () => {
  it("opens preview after create instead of closing immediately", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sheet = readFileSync(
      join(
        process.cwd(),
        "src/features/pacientes/components/pacientes/workspace/patient-order-sheet.tsx"
      ),
      "utf8"
    );
    // v2: after create/issue the sheet shows the order detail (PDF, print, QR link) until "Listo".
    expect(sheet).toMatch(/MedicalOrderDetail/);
    expect(sheet).toMatch(/handleCreated/);
    expect(sheet).toMatch(/Orden médica guardada/);
    expect(sheet).toMatch(/Listo/);
  });

  it("preview sheet exposes print and done actions", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const preview = readFileSync(
      join(
        process.cwd(),
        "src/features/recetas/components/recetas/medical-order-preview-sheet.tsx"
      ),
      "utf8"
    );
    expect(preview).toMatch(/Imprimir \/ Guardar PDF/);
    expect(preview).toMatch(/Listo/);
    expect(preview).toMatch(/printMedicalOrderDocument/);
  });
});
