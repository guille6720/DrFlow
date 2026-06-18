import { describe, expect, it } from "vitest";
import { QA_CHECKLIST, qaStats } from "@/lib/qa/checklist-data";

describe("qa checklist", () => {
  it("has sections with unique item ids", () => {
    const ids = QA_CHECKLIST.flatMap((s) => s.items.map((i) => i.id));
    expect(ids.length).toBeGreaterThan(40);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("calculates progress stats", () => {
    const firstId = QA_CHECKLIST[0]!.items[0]!.id;
    const stats = qaStats({ [firstId]: true });
    expect(stats.done).toBe(1);
    expect(stats.total).toBeGreaterThan(1);
    expect(stats.percent).toBeGreaterThan(0);
  });
});
