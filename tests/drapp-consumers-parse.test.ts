import { describe, it, expect } from "vitest";
import {
  parseDrAppConsumerLine,
  parseDrAppConsumerLines,
  isDrAppConsumersHeaderCell,
} from "@/lib/utils/drapp-consumers-parse";

const SAMPLE =
  'Marta,\\"Falcon\\",\\"1954-06-16\\",\\"ar\\",\\"11552015\\",\\"\\",\\"+5458817840\\",\\"\\",\\"PAMI\\",\\"2022-03-09T11:23:23.557Z\\",\\"osleonardi@gmail.com\\",\\"teams/6dac9267\\",\\"consumers/348c8444\\"';

describe("drapp consumers parse", () => {
  it("detects header cell", () => {
    expect(isDrAppConsumersHeaderCell('firstName,"lastName","identification"')).toBe(true);
  });

  it("parses embedded consumer line", () => {
    const parsed = parseDrAppConsumerLine(SAMPLE, 2);
    expect("record" in parsed).toBe(true);
    if (!("record" in parsed)) return;
    expect(parsed.record.document_number).toBe("11552015");
    expect(parsed.record.last_name).toBe("Falcon");
    expect(parsed.record.first_name).toBe("Marta");
    expect(parsed.record.insurance_provider).toBe("PAMI");
    expect(parsed.record.birth_date).toBe("1954-06-16");
  });

  it("parses PAMI with affiliate number", () => {
    const line =
      'Osbaldo De Jesus,\\"Ibarra\\",\\"1951-12-25\\",\\"ar\\",\\"10129753\\",\\"male\\",\\"+541128687468\\",\\"\\",\\"PAMI #15051146820100\\",\\"2019-08-16T17:27:22.302Z\\",\\"a\\",\\"b\\",\\"consumers/x\\"';
    const { records } = parseDrAppConsumerLines([line], 10);
    expect(records[0]?.insurance_number).toBe("15051146820100");
  });
});
