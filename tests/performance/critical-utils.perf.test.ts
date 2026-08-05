import { describe, expect, it } from "vitest";

import type { CommandPaletteItemDef } from "@/lib/constants/command-palette-items";
import { parseClinicalCsvContent } from "@/lib/utils/clinical-csv-parse";
import { filterCommandPaletteItems } from "@/lib/utils/command-palette-search";

describe("performance — critical parse paths", () => {
  it("parses 500-row clinical CSV under 1s", () => {
    const header = "dni,apellido,nombre,fecha_consulta,evolucion\n";
    const rows = Array.from({ length: 500 }, (_, i) =>
      `1234567${i % 10},Apellido${i},Nombre${i},2026-01-01,Evolución ${i}`
    ).join("\n");
    const csv = header + rows;

    const start = performance.now();
    const result = parseClinicalCsvContent(csv);
    const elapsed = performance.now() - start;

    expect(result.rows.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });

  it("filters command palette items under 50ms for large list", () => {
    const items: CommandPaletteItemDef[] = Array.from({ length: 200 }, (_, i) => ({
      id: `item-${i}`,
      label: `Acción ${i}`,
      href: `/ruta-${i}`,
      group: "navegacion" as const,
      keywords: [`keyword${i}`],
    }));

    const start = performance.now();
    const hits = filterCommandPaletteItems(items, "Acción 12", "doctor", false);
    const elapsed = performance.now() - start;

    expect(hits.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
  });
});
