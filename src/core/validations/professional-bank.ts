import { z } from "zod";

import {
  PROFESSIONAL_BANK_ACCOUNT_TYPE_OPTIONS,
  PROFESSIONAL_IVA_STATUS_OPTIONS,
} from "@/lib/constants/professional-bank";

const ivaValues = PROFESSIONAL_IVA_STATUS_OPTIONS.map((o) => o.value);
const accountTypeValues = PROFESSIONAL_BANK_ACCOUNT_TYPE_OPTIONS.map((o) => o.value);

export const professionalBankFormSchema = z.object({
  taxId: z
    .string()
    .max(13)
    .regex(/^[\d-]*$/, "CUIL/CUIT inválido")
    .optional()
    .or(z.literal("")),
  ivaStatus: z
    .string()
    .refine((v) => !v || (ivaValues as readonly string[]).includes(v), "Condición IVA inválida"),
  bankName: z.string().max(120).optional().or(z.literal("")),
  bankAccountType: z
    .string()
    .refine(
      (v) => !v || (accountTypeValues as readonly string[]).includes(v),
      "Tipo de cuenta inválido"
    ),
  bankAccountNumber: z
    .string()
    .max(40)
    .regex(/^[\d-]*$/, "Número de cuenta inválido")
    .optional()
    .or(z.literal("")),
  bankCbu: z
    .string()
    .regex(/^(\d{22})?$/, "CBU debe tener 22 dígitos")
    .optional()
    .or(z.literal("")),
  bankAlias: z
    .string()
    .max(30)
    .regex(/^[a-zA-Z0-9.-]*$/, "Alias inválido")
    .optional()
    .or(z.literal("")),
});

export type ProfessionalBankFormInput = z.infer<typeof professionalBankFormSchema>;

export function parseProfessionalBankForm(formData: FormData): ProfessionalBankFormInput {
  return {
    taxId: String(formData.get("taxId") ?? "").trim(),
    ivaStatus: String(formData.get("ivaStatus") ?? "").trim(),
    bankName: String(formData.get("bankName") ?? "").trim(),
    bankAccountType: String(formData.get("bankAccountType") ?? "").trim(),
    bankAccountNumber: String(formData.get("bankAccountNumber") ?? "").trim(),
    bankCbu: String(formData.get("bankCbu") ?? "").trim(),
    bankAlias: String(formData.get("bankAlias") ?? "").trim(),
  };
}
