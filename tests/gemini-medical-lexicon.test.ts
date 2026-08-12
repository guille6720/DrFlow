import { describe, expect, it } from "vitest";

import {
  findProtocolByMessage,
  foldMedicalText,
  formatProtocolCatalogForPrompt,
  GEMINI_CLINICAL_PROTOCOLS,
  GEMINI_LEXICON_CONDITIONS,
} from "@/lib/ai/gemini-medical-lexicon";

describe("gemini medical lexicon", () => {
  it("covers respiratory and cardiometabolic protocol families", () => {
    const ids = GEMINI_CLINICAL_PROTOCOLS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "gzmr",
        "presto",
        "theseus",
        "bronquiectasias",
        "bax-duo",
        "ekgb",
        "gzpw",
        "maritime-cv",
        "maritime-hf",
        "hf-polaris",
        "azure",
      ])
    );
  });

  it("indexes key clinical terms from flyers", () => {
    const labels = GEMINI_LEXICON_CONDITIONS.map((c) => c.id);
    expect(labels).toEqual(
      expect.arrayContaining(["asma", "epoc", "bronquiectasias", "ascvd", "ic", "erc", "obesidad"])
    );
  });

  it("formats protocol criteria for Gemini context", () => {
    const presto = findProtocolByMessage(foldMedicalText("estudio presto epoc"));
    const text = formatProtocolCatalogForPrompt(presto);
    expect(text).toContain("PRESTO");
    expect(text).toContain("VEF1");
  });
});
