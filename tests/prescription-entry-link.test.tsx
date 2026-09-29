import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({
  integration: true,
  prescriptions: true,
  clinicProduct: true,
}));

vi.mock("@/core/components/customizations/feature-customizations-provider", () => ({
  useFeature: (key: string) => ({
    enabled:
      key === "rcta_integration" ? flags.integration : key === "rcta_prescriptions" ? flags.prescriptions : false,
  }),
}));
vi.mock("@/core/components/products/products-provider", () => ({
  useHasClinicProduct: () => flags.clinicProduct,
}));

import { PrescriptionEntryLink } from "@/features/recetas/components/recetas/prescription-entry-link";

import { RCTA_FEATURE_KEYS } from "@/lib/integrations/rcta/access";

const PATIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FALLBACK = `/pacientes/${PATIENT_ID}?tab=recetas&action=nueva`;

beforeEach(() => {
  flags.integration = true;
  flags.prescriptions = true;
  flags.clinicProduct = true;
});

afterEach(() => cleanup());

describe("PrescriptionEntryLink", () => {
  it("uses the RCTA feature keys", () => {
    expect(RCTA_FEATURE_KEYS.integration).toBe("rcta_integration");
    expect(RCTA_FEATURE_KEYS.prescriptions).toBe("rcta_prescriptions");
  });

  it("opens RCTA in a new tab without patient data when enabled", () => {
    render(<PrescriptionEntryLink fallbackHref={FALLBACK}>Receta</PrescriptionEntryLink>);
    const link = screen.getByRole("link", { name: "Receta" });
    expect(link).toHaveAttribute("href", "https://app.rcta.me/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link.getAttribute("href")).not.toContain(PATIENT_ID);
  });

  it.each(["integration", "prescriptions", "clinicProduct"] as const)(
    "falls back to the internal editor when %s is disabled",
    (flag) => {
      flags[flag] = false;
      render(<PrescriptionEntryLink fallbackHref={FALLBACK}>Receta</PrescriptionEntryLink>);
      const link = screen.getByRole("link", { name: "Receta" });
      expect(link).toHaveAttribute("href", FALLBACK);
      expect(link).not.toHaveAttribute("target");
    }
  );
});
