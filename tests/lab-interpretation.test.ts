import { describe, expect, it } from "vitest";
import {
  buildLabInterpretationItem,
  buildLabInterpretationPlainText,
  classifyLabValue,
  compareLabsWithHistory,
  parseLabValuesFromText,
} from "@/lib/utils/lab-interpretation";

describe("lab-interpretation", () => {
  it("parseLabValuesFromText extracts hba1c and glucemia", () => {
    const text = "HbA1c 7.2 %\nGlucemia: 118 mg/dl\nCreatinina 1.15 mg/dl";
    const parsed = parseLabValuesFromText(text);
    expect(parsed.some((p) => p.name === "HbA1c" && p.value === 7.2)).toBe(true);
    expect(parsed.some((p) => p.name === "Glucemia" && p.value === 118)).toBe(true);
    expect(parsed.some((p) => p.name === "Creatinina" && p.value === 1.15)).toBe(true);
  });

  it("classifyLabValue flags high hba1c", () => {
    expect(classifyLabValue("HbA1c", 7.2)).toBe("high");
    expect(classifyLabValue("Glucemia", 90)).toBe("normal");
  });

  it("compareLabsWithHistory detects trend vs previous", () => {
    const parsed = parseLabValuesFromText("HbA1c 7.2 %");
    const rows = compareLabsWithHistory(parsed, [{ name: "HbA1c", value: "6.8", status: "high" }]);
    expect(rows[0]?.trend).toBe("up");
    expect(rows[0]?.previous).toContain("6.8");
  });

  it("compareLabsWithHistory marks stable small delta", () => {
    const parsed = parseLabValuesFromText("Creatinina 1.10");
    const rows = compareLabsWithHistory(parsed, [
      { name: "Creatinina", value: "1.08", status: "normal", unit: "mg/dl" },
    ]);
    expect(rows[0]?.trend).toBe("stable");
    expect(rows[0]?.deltaLabel).toContain("Estable");
  });

  it("compareLabsWithHistory detects downward trend", () => {
    const parsed = parseLabValuesFromText("Glucemia 88");
    const rows = compareLabsWithHistory(parsed, [{ name: "Glucemia", value: "110", status: "high" }]);
    expect(rows[0]?.trend).toBe("down");
  });

  it("parseLabValuesFromText supports reversed hba1c format", () => {
    const parsed = parseLabValuesFromText("7.1 % de HbA1c");
    expect(parsed.some((p) => p.name === "HbA1c" && p.value === 7.1)).toBe(true);
  });

  it("classifyLabValue flags low glucemia", () => {
    expect(classifyLabValue("Glucemia", 65)).toBe("low");
  });

  it("buildLabInterpretationItem summarizes abnormal values", () => {
    const item = buildLabInterpretationItem({
      sourceText: "HbA1c 7.2 %",
    });
    expect(item?.kind).toBe("lab_interpretation");
    expect(item?.body).toContain("Fuera de rango");
  });

  it("buildLabInterpretationPlainText formats rows", () => {
    const rows = compareLabsWithHistory(parseLabValuesFromText("HbA1c 7.2 %"));
    const text = buildLabInterpretationPlainText(rows);
    expect(text).toContain("HbA1c");
  });

  it("buildLabInterpretationItem returns null for empty parse", () => {
    expect(buildLabInterpretationItem({ sourceText: "sin datos" })).toBeNull();
  });
});
