import { describe, expect, it } from "vitest";
import {
  calculateBmi,
  calculatePackYears,
  estimateTfgCkdEpi,
} from "@/lib/utils/clinical-indicators";

describe("clinical-indicators", () => {
  it("calculates BMI", () => {
    expect(calculateBmi(72, 165)).toBe(26.4);
  });

  it("calculates pack-years", () => {
    expect(calculatePackYears(20, 10)).toBe(10);
  });

  it("estimates TFG with sex", () => {
    const tfg = estimateTfgCkdEpi({
      ageYears: 51,
      creatinineMgDl: 0.9,
      sex: "F",
    });
    expect(tfg).toBeGreaterThan(50);
  });
});
