import { describe, expect, it } from "vitest";

import {
  parseProfessionalBankForm,
  professionalBankFormSchema,
} from "@/core/validations/professional-bank";

describe("professional bank form", () => {
  it("accepts valid banking data", () => {
    const raw = {
      taxId: "20-12345678-9",
      ivaStatus: "monotributo",
      bankName: "Banco Nación",
      bankAccountType: "caja_ahorro",
      bankAccountNumber: "1234567890",
      bankCbu: "1234567890123456789012",
      bankAlias: "medico.consultorio",
    };
    expect(professionalBankFormSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects invalid CBU length", () => {
    const parsed = professionalBankFormSchema.safeParse({
      taxId: "",
      ivaStatus: "",
      bankName: "",
      bankAccountType: "",
      bankAccountNumber: "",
      bankCbu: "123",
      bankAlias: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("parses form data fields", () => {
    const fd = new FormData();
    fd.set("taxId", "20123456789");
    fd.set("bankAlias", "dr.castro");
    const parsed = parseProfessionalBankForm(fd);
    expect(parsed.taxId).toBe("20123456789");
    expect(parsed.bankAlias).toBe("dr.castro");
  });
});
