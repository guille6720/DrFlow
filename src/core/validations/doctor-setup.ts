import { z } from "zod";
import { SPECIALTY_OTHER_VALUE } from "@/lib/constants/medical-specialties";

const dniSchema = z
  .string()
  .min(7, "Ingresá un DNI válido (mín. 7 dígitos)")
  .max(11, "DNI demasiado largo")
  .regex(/^\d+$/, "El DNI solo debe contener números");

const phoneRequiredSchema = z
  .string()
  .min(8, "Ingresá un teléfono de contacto para turnos (mín. 8 dígitos)");

const licenseSchema = z.string().min(3, "Ingresá la matrícula (mín. 3 caracteres)");

/** Campos del médico titular al crear consultorio. */
export const doctorSetupFieldsSchema = z.object({
  doctorFirstName: z.string().min(2, "Ingresá el nombre del médico"),
  doctorLastName: z.string().min(2, "Ingresá el apellido del médico"),
  documentNumber: dniSchema,
  phone: phoneRequiredSchema,
  specialtySelect: z.string().min(1, "Seleccioná una especialidad"),
  specialtyCustom: z.string().optional(),
  licenseNational: licenseSchema,
  licenseProvincial: z.string().optional(),
});

export function resolveSpecialtyValue(data: {
  specialtySelect: string;
  specialtyCustom?: string;
}): string {
  if (data.specialtySelect === SPECIALTY_OTHER_VALUE) {
    const custom = data.specialtyCustom?.trim();
    if (!custom || custom.length < 2) {
      throw new Error("SPECIALTY_CUSTOM");
    }
    return custom;
  }
  return data.specialtySelect;
}

export function parseDoctorSetupFromForm(formData: FormData) {
  const licenseProvincial = String(formData.get("licenseProvincial") ?? "").trim();
  return {
    doctorFirstName: String(formData.get("doctorFirstName") ?? "").trim(),
    doctorLastName: String(formData.get("doctorLastName") ?? "").trim(),
    documentNumber: String(formData.get("documentNumber") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    specialtySelect: String(formData.get("specialtySelect") ?? "").trim(),
    specialtyCustom: String(formData.get("specialtyCustom") ?? "").trim() || undefined,
    licenseNational: String(formData.get("licenseNational") ?? "").trim(),
    licenseProvincial: licenseProvincial || undefined,
  };
}

export function validateDoctorSetup(raw: ReturnType<typeof parseDoctorSetupFromForm>) {
  const parsed = doctorSetupFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error } as const;
  }

  let specialty: string;
  try {
    specialty = resolveSpecialtyValue(parsed.data);
  } catch {
    return {
      fieldErrors: { specialtyCustom: "Escribí la especialidad manualmente" },
    } as const;
  }

  return {
    data: {
      doctorFirstName: parsed.data.doctorFirstName,
      doctorLastName: parsed.data.doctorLastName,
      documentNumber: parsed.data.documentNumber,
      phone: parsed.data.phone,
      specialty,
      licenseNational: parsed.data.licenseNational,
      licenseProvincial: parsed.data.licenseProvincial || parsed.data.licenseNational,
    },
  } as const;
}
