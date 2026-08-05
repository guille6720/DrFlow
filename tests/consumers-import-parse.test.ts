import { describe, expect, it } from "vitest";

import {
  isConsumersImportHeaderCell,
  parseConsumerImportLine,
  parseConsumerImportLines,
} from "@/lib/utils/consumers-import-parse";

const SAMPLE =
  '"Maria","Garcia","1990-01-15","ar","30123456","","1155551234","maria@test.com","PAMI #123456789012","","","","consumers/abc123"';

describe("consumers import parse", () => {
  it("detects header cell", () => {
    expect(isConsumersImportHeaderCell('firstName,"lastName","identification"')).toBe(true);
  });

  it("parses consumer line", () => {
    const parsed = parseConsumerImportLine(SAMPLE, 2);
    expect("record" in parsed).toBe(true);
    if ("record" in parsed) {
      expect(parsed.record.document_number).toBe("30123456");
      expect(parsed.record.external_consumer_id).toBe("consumers/abc123");
    }
  });

  it("parses lines batch", () => {
    const line =
      '"Juan","Perez","1985-05-05","ar","28987654","","","","","","","","consumers/xyz"';
    const { records } = parseConsumerImportLines([line], 10);
    expect(records).toHaveLength(1);
  });
});
