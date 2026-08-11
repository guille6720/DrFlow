import { describe, expect, it } from "vitest";

import {
  resolveClinicalRecordDocumentSignature,
  resolveProfessionalDocumentSignature,
} from "@/lib/utils/professional-signature-document";

describe("professional document signature", () => {
  it("uses configured signature text and image from professional profile", () => {
    const signature = resolveProfessionalDocumentSignature({
      display_name: "Castro, Guillermo",
      license_number: "123456",
      signature_text: "Dr/a. Castro, Guillermo - Mat. MN123456",
      signature_image_url: "https://example.com/firma.png",
    });

    expect(signature.signatureText).toBe("Dr/a. Castro, Guillermo - Mat. MN123456");
    expect(signature.signatureImageUrl).toBe("https://example.com/firma.png");
  });

  it("falls back to generated signature when custom text is missing", () => {
    const signature = resolveProfessionalDocumentSignature({
      display_name: "Castro, Guillermo",
      license_national: "123456",
    });

    expect(signature.signatureText).toContain("Castro, Guillermo");
    expect(signature.signatureText).toContain("Mat. 123456");
  });

  it("resolves clinical record signature from professional id", () => {
    const signature = resolveClinicalRecordDocumentSignature({
      professionalId: "pro-1",
      professionals: [
        {
          id: "pro-1",
          signature_text: "Dr/a. Castro, Guillermo - Mat. MN123456",
          signature_image_url: "https://example.com/firma.png",
        },
      ],
    });

    expect(signature.signatureText).toContain("Castro, Guillermo");
    expect(signature.signatureImageUrl).toBe("https://example.com/firma.png");
  });
});
