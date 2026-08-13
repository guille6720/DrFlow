import { describe, expect, it } from "vitest";

import {
  buildClinicalHistoryFilename,
  clinicalHistoryPrintTitle,
  formatLocalDownloadStamp,
  sanitizeClinicalFilenamePart,
} from "@/lib/utils/clinical-history-filename";

describe("clinical-history-filename", () => {
  it("strips accents and unsafe characters", () => {
    expect(sanitizeClinicalFilenamePart("Castro, Ángel")).toBe("Castro_Angel");
  });

  it("builds a local date-time stamp", () => {
    expect(formatLocalDownloadStamp(new Date(2026, 7, 13, 15, 7, 0))).toBe("2026-08-13_15-07");
  });

  it("includes patient name, DNI, date and time", () => {
    const filename = buildClinicalHistoryFilename({
      last_name: "castro",
      first_name: "angel",
      document_number: "5844743",
      downloadedAt: new Date(2026, 7, 13, 15, 7, 0),
    });
    expect(filename).toBe("castro_angel_5844743_2026-08-13_15-07.pdf");
  });

  it("omits .pdf from the print title used by Save as PDF", () => {
    expect(
      clinicalHistoryPrintTitle({
        last_name: "castro",
        first_name: "angel",
        document_number: "5844743",
        downloadedAt: new Date(2026, 7, 13, 15, 7, 0),
      })
    ).toBe("castro_angel_5844743_2026-08-13_15-07");
  });
});
