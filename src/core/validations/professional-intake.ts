import { z } from "zod";
import { optionalEntityIdSchema } from "@/core/validations/params";
import { SPECIALTY_OTHER_VALUE } from "@/lib/constants/medical-specialties";

export const professionalIntakeFormSchema = z.object({
  doctorFirstName: z.string().min(2, "Nombre obligatorio").max(60),
  doctorLastName: z.string().min(2, "Apellido obligatorio").max(60),
  documentNumber: z
    .string()
    .min(7, "DNI inválido")
    .max(11)
    .regex(/^\d+$/, "DNI inválido"),
  email: z.string().email("Email inválido").max(120).optional().or(z.literal("")),
  phone: z.string().min(8, "Teléfono obligatorio").max(30),
  licenseNational: z.string().min(3, "Matrícula nacional obligatoria").max(30),
  licenseProvincial: z.string().max(30).optional(),
  officeAddress: z.string().max(300).optional(),
  officePhone: z.string().max(30).optional(),
  acceptedInsurances: z.string().max(500).optional(),
  intakeNotes: z.string().max(2000).optional(),
  location_id: optionalEntityIdSchema,
  specialtySelect: z.string().min(1, "Seleccioná una especialidad"),
  specialtyCustom: z.string().max(80).optional(),
});

export type ProfessionalIntakeFormInput = z.infer<typeof professionalIntakeFormSchema>;

export function parseProfessionalIntakeForm(formData: FormData): ProfessionalIntakeFormInput {
  const locationId = String(formData.get("location_id") ?? "").trim();
  return {
    doctorFirstName: String(formData.get("doctorFirstName") ?? "").trim(),
    doctorLastName: String(formData.get("doctorLastName") ?? "").trim(),
    documentNumber: String(formData.get("documentNumber") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    licenseNational: String(formData.get("licenseNational") ?? "").trim(),
    licenseProvincial: String(formData.get("licenseProvincial") ?? "").trim() || undefined,
    officeAddress: String(formData.get("officeAddress") ?? "").trim() || undefined,
    officePhone: String(formData.get("officePhone") ?? "").trim() || undefined,
    acceptedInsurances: String(formData.get("acceptedInsurances") ?? "").trim() || undefined,
    intakeNotes: String(formData.get("intakeNotes") ?? "").trim() || undefined,
    location_id: locationId || null,
    specialtySelect: String(formData.get("specialtySelect") ?? "").trim(),
    specialtyCustom: String(formData.get("specialtyCustom") ?? "").trim() || undefined,
  };
}

export function resolveIntakeSpecialtyName(data: ProfessionalIntakeFormInput): string {
  if (data.specialtySelect === SPECIALTY_OTHER_VALUE) {
    const custom = data.specialtyCustom?.trim();
    if (!custom || custom.length < 3) {
      throw new Error("Especialidad manual demasiado corta.");
    }
    return custom;
  }
  return data.specialtySelect;
}
