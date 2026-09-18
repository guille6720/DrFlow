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
        "endura-2",
        "bronquiectasias",
        "kt621",
        "ydao",
        "bax-duo",
        "ekgb",
        "attain-now",
        "gzpw",
        "maritime-cv",
        "zenith",
        "maritime-hf",
        "hf-polaris",
        "azure",
      ])
    );
  });

  it("indexes key clinical terms from flyers", () => {
    const labels = GEMINI_LEXICON_CONDITIONS.map((c) => c.id);
    expect(labels).toEqual(
      expect.arrayContaining([
        "asma",
        "epoc",
        "bronquiectasias",
        "ascvd",
        "ic",
        "erc",
        "obesidad",
        "hta",
        "apnea_sueno",
      ])
    );
  });

  it("resolves ZENITH protocol aliases", () => {
    expect(findProtocolByMessage(foldMedicalText("protocolo zenith hta"))?.id).toBe("zenith");
    expect(findProtocolByMessage(foldMedicalText("nct07181109"))?.id).toBe("zenith");
  });

  it("resolves new flyer protocols ENDURA-2, YDAO and KT621", () => {
    expect(findProtocolByMessage(foldMedicalText("candidatos endura 2"))?.id).toBe("endura-2");
    expect(findProtocolByMessage(foldMedicalText("estudio 222725"))?.id).toBe("endura-2");
    expect(findProtocolByMessage(foldMedicalText("candidatos ydao apnea"))?.id).toBe("ydao");
    expect(findProtocolByMessage(foldMedicalText("j3r-mc-ydao"))?.id).toBe("ydao");
    expect(findProtocolByMessage(foldMedicalText("protocolo kt621 asma"))?.id).toBe("kt621");
  });

  it("resolves ATTAIN-NOW and Muvalaplin / primer evento ASCVD", () => {
    expect(findProtocolByMessage(foldMedicalText("estudio clinico attain-now"))?.id).toBe(
      "attain-now"
    );
    expect(findProtocolByMessage(foldMedicalText("candidatos attain now"))?.id).toBe("attain-now");
    expect(findProtocolByMessage(foldMedicalText("riesgo de primer evento ascvd"))?.id).toBe("ekgb");
    expect(findProtocolByMessage(foldMedicalText("muvalaplin lp(a)"))?.id).toBe("ekgb");
    expect(findProtocolByMessage(foldMedicalText("attain-outcomes orforglipron"))?.id).toBe("gzpw");
  });

  it("formats protocol criteria for Gemini context", () => {
    const presto = findProtocolByMessage(foldMedicalText("estudio presto epoc"));
    const text = formatProtocolCatalogForPrompt(presto);
    expect(text).toContain("PRESTO");
    expect(text).toContain("VEF1");
  });
});
