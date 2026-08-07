import { describe, expect, it } from "vitest";

import {
  formatPamiCabeceraSuccessMessage,
  pamiCabeceraSeedChanged,
} from "@/features/pami/server/pami-cabecera-setup";

describe("pami cabecera seed helpers", () => {
  describe("pamiCabeceraSeedChanged", () => {
    it("returns false when already configured and RPC reports no changes", () => {
      expect(
        pamiCabeceraSeedChanged({
          already_configured: true,
          changed: false,
          templates_added: 0,
          reasons_added: 0,
        })
      ).toBe(false);
    });

    it("returns true when RPC reports changed", () => {
      expect(pamiCabeceraSeedChanged({ changed: true, templates_added: 0 })).toBe(true);
    });

    it("falls back to insert counts when changed flag is absent", () => {
      expect(pamiCabeceraSeedChanged({ templates_added: 0, reasons_added: 1 })).toBe(true);
    });
  });

  describe("formatPamiCabeceraSuccessMessage", () => {
    it("reports no-op on repeated fully configured runs", () => {
      expect(
        formatPamiCabeceraSuccessMessage({
          already_configured: true,
          changed: false,
          templates_added: 0,
          reasons_added: 0,
        })
      ).toBe("El consultorio PAMI ya estaba configurado. No se realizaron cambios.");
    });

    it("reports partial repair when missing templates are added", () => {
      expect(
        formatPamiCabeceraSuccessMessage({
          already_configured: false,
          changed: true,
          templates_added: 2,
          reasons_added: 0,
        })
      ).toContain("2 plantillas clínicas nuevas");
    });

    it("reports first-time setup counts", () => {
      expect(
        formatPamiCabeceraSuccessMessage({
          changed: true,
          templates_added: 5,
          reasons_added: 6,
        })
      ).toContain("Consultorio PAMI listo");
    });
  });
});
