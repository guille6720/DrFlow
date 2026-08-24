import { describe, expect, it } from "vitest";

import { FEATURES } from "@/core/entitlements/features";
import {
  filterEntitledHrefItems,
  isHrefEntitledBySnapshot,
  navFeatureForHref,
} from "@/core/entitlements/nav-features";
import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

describe("navFeatureForHref", () => {
  it("maps exact add-on routes", () => {
    expect(navFeatureForHref("/caja")).toBe(FEATURES.CASH_REGISTER);
    expect(navFeatureForHref("/herramientas/farmacologia")).toBe(FEATURES.PHARMACOLOGY);
    expect(navFeatureForHref("/facturacion/liquidacion")).toBe(FEATURES.INSURANCE);
    expect(navFeatureForHref("/facturacion/tarifas")).toBe(FEATURES.INSURANCE);
    expect(navFeatureForHref("/gemini")).toBe(FEATURES.AI);
    expect(navFeatureForHref("/telemedicina")).toBe(FEATURES.TELEMEDICINE);
    expect(navFeatureForHref("/recordatorios")).toBe(FEATURES.WHATSAPP_REMINDERS);
    expect(navFeatureForHref("/pami/planillas")).toBe(FEATURES.PAMI);
    expect(navFeatureForHref("/reportes/bi")).toBe(FEATURES.ADVANCED_REPORTS);
  });

  it("maps nested caja and facturacion routes", () => {
    expect(navFeatureForHref("/caja/cierre")).toBe(FEATURES.CASH_REGISTER);
    expect(navFeatureForHref("/caja/reportes")).toBe(FEATURES.CASH_REGISTER);
    expect(navFeatureForHref("/facturacion/liquidacion/nueva")).toBe(FEATURES.INSURANCE);
  });

  it("does not gate core clinical or datos import", () => {
    expect(navFeatureForHref("/pacientes")).toBeUndefined();
    expect(navFeatureForHref("/datos")).toBeUndefined();
    expect(navFeatureForHref("/dashboard")).toBeUndefined();
  });

  it("fails open when the catalog is missing", () => {
    const snapshot: ClientEntitlementsSnapshot = {
      catalogAvailable: false,
      planKey: null,
      status: null,
      allowed: {},
      usage: {},
      limits: {},
    };
    expect(isHrefEntitledBySnapshot("/caja", snapshot)).toBe(true);
  });

  it("hides caja when the catalog denies cash_register", () => {
    const snapshot: ClientEntitlementsSnapshot = {
      catalogAvailable: true,
      planKey: "basic",
      status: "active",
      allowed: { [FEATURES.CASH_REGISTER]: false },
      usage: {},
      limits: {},
    };
    expect(isHrefEntitledBySnapshot("/caja", snapshot)).toBe(false);
    expect(isHrefEntitledBySnapshot("/caja/cierre", snapshot)).toBe(false);
    expect(isHrefEntitledBySnapshot("/pacientes", snapshot)).toBe(true);
  });

  it("filters add-on hrefs from mixed lists", () => {
    const snapshot: ClientEntitlementsSnapshot = {
      catalogAvailable: true,
      planKey: "basic",
      status: "active",
      allowed: { [FEATURES.CASH_REGISTER]: false, [FEATURES.WHATSAPP_REMINDERS]: false },
      usage: {},
      limits: {},
    };
    const items = filterEntitledHrefItems(
      [
        { href: "/agenda", label: "Agenda" },
        { href: "/caja", label: "Caja" },
        { href: "/recordatorios", label: "Recordatorios" },
        { label: "Sin link" },
      ],
      snapshot
    );
    expect(items.map((item) => item.label)).toEqual(["Agenda", "Sin link"]);
  });

  it("hides account add-on modules when the catalog denies them", () => {
    const snapshot: ClientEntitlementsSnapshot = {
      catalogAvailable: true,
      planKey: "basic",
      status: "active",
      allowed: {
        [FEATURES.TELEMEDICINE]: false,
        [FEATURES.AI]: false,
        [FEATURES.PAMI]: false,
        [FEATURES.PHARMACOLOGY]: false,
        [FEATURES.ADVANCED_REPORTS]: false,
        [FEATURES.INSURANCE]: false,
      },
      usage: {},
      limits: {},
    };
    expect(isHrefEntitledBySnapshot("/telemedicina", snapshot)).toBe(false);
    expect(isHrefEntitledBySnapshot("/gemini", snapshot)).toBe(false);
    // Phase 29: PAMI + advanced reports stay available (existing modules, no production gating yet)
    expect(isHrefEntitledBySnapshot("/pami/planillas", snapshot)).toBe(true);
    expect(isHrefEntitledBySnapshot("/herramientas/farmacologia", snapshot)).toBe(false);
    expect(isHrefEntitledBySnapshot("/reportes/bi", snapshot)).toBe(true);
    expect(isHrefEntitledBySnapshot("/facturacion/liquidacion", snapshot)).toBe(false);
    expect(isHrefEntitledBySnapshot("/historias", snapshot)).toBe(true);
  });
});
