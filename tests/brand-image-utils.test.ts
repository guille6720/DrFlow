import { describe, expect, it } from "vitest";

import {
  brandIconSizes,
  resolvePatientAppIconSrc,
} from "@/core/components/brand/brand-image-utils";

import {
  PATIENT_PWA_ICON_192,
  PATIENT_PWA_ICON_512,
} from "@/features/pacientes/utils/patient-portal-ready";

describe("brand image utils", () => {
  it("uses 192px PWA asset for small patient icons", () => {
    expect(resolvePatientAppIconSrc(64)).toBe(PATIENT_PWA_ICON_192);
    expect(resolvePatientAppIconSrc(96)).toBe(PATIENT_PWA_ICON_192);
  });

  it("uses 512px PWA asset for large patient icons", () => {
    expect(resolvePatientAppIconSrc(128)).toBe(PATIENT_PWA_ICON_512);
  });

  it("builds sizes attribute from display px", () => {
    expect(brandIconSizes(88)).toBe("88px");
  });
});
