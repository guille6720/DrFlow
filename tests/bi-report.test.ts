import { describe, expect, it } from "vitest";

import {
  buildBiReportCsv,
  emptyClinicBiReport,
  parseBiReportPeriod,
  topBiRows,
} from "@/features/reportes/utils/bi-report";

describe("parseBiReportPeriod", () => {
  it("defaults to monthly", () => {
    expect(parseBiReportPeriod(undefined)).toBe("monthly");
    expect(parseBiReportPeriod("invalid")).toBe("monthly");
  });

  it("accepts valid periods", () => {
    expect(parseBiReportPeriod("weekly")).toBe("weekly");
  });
});

describe("buildBiReportCsv", () => {
  it("includes coverage and specialty sections", () => {
    const report = {
      ...emptyClinicBiReport(),
      appointment_stats: {
        ...emptyClinicBiReport().appointment_stats,
        attended: 10,
        attendance_rate: 80,
      },
      by_coverage: [{ coverage: "OSDE", count: 6, pct: 60 }],
      by_specialty: [{ specialty: "Clínica", count: 8, pct: 80 }],
    };
    const csv = buildBiReportCsv(report, "Agosto 2026");
    expect(csv.some((row) => row[0] === "OSDE")).toBe(true);
    expect(csv.some((row) => row[0] === "Clínica")).toBe(true);
  });
});

describe("topBiRows", () => {
  it("returns top N by count", () => {
    expect(
      topBiRows(
        [
          { name: "a", count: 1 },
          { name: "b", count: 5 },
        ],
        1
      )
    ).toEqual([{ name: "b", count: 5 }]);
  });
});
