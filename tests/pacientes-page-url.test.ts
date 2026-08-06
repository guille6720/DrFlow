import { describe, expect, it } from "vitest";

import {
  buildPacientesPageQuery,
  buildPacientesSearchUrl,
  resolvePacientesClearHref,
} from "@/features/pacientes/utils/pacientes-page-url";

describe("pacientes page URLs", () => {
  it("builds live search URL from name query", () => {
    expect(buildPacientesSearchUrl("z")).toBe("/pacientes?q=z");
  });

  it("builds live search URL with pathology and PAMI filter", () => {
    expect(buildPacientesSearchUrl("z", "pami", "epoc")).toBe(
      "/pacientes?q=z&patologia=epoc&cobertura=pami"
    );
  });

  it("builds paginated URL", () => {
    expect(buildPacientesPageQuery(2, "z", undefined, "epoc")).toBe(
      "/pacientes?page=2&q=z&patologia=epoc"
    );
  });

  it("resolves clear href when filters are active", () => {
    expect(resolvePacientesClearHref("z")).toBe("/pacientes");
    expect(resolvePacientesClearHref("", "pami")).toBe("/pacientes?cobertura=pami");
    expect(resolvePacientesClearHref("", undefined, "asma")).toBe("/pacientes");
  });
});
