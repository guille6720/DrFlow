import {
  IMAGING_CONTRAST_LABELS,
  type ImagingContrast,
  MEDICAL_ORDER_CATEGORY_LABELS,
  MEDICAL_ORDER_VERIFY_PATH,
  type MedicalOrderCategory,
} from "@/features/ordenes-medicas/constants";
import type { MedicalOrderInput } from "@/features/ordenes-medicas/validation";

/** Plain-text body stored in `order_text` (legacy screens, timeline, search). */
export function composeMedicalOrderText(input: Pick<MedicalOrderInput, "category" | "items">): string {
  const header = MEDICAL_ORDER_CATEGORY_LABELS[input.category];
  const lines = input.items.map((item) => {
    const parts = [item.name];
    if (item.imaging?.body_region) parts.push(`Región: ${item.imaging.body_region}`);
    if (item.imaging?.contrast) parts.push(IMAGING_CONTRAST_LABELS[item.imaging.contrast]);
    if (item.description) parts.push(item.description);
    return `- ${parts.join(" · ")}`;
  });
  return `${header}\n${lines.join("\n")}`;
}

export function buildItemMetadata(item: MedicalOrderInput["items"][number]): Record<string, unknown> {
  if (!item.imaging) return {};
  const meta: Record<string, unknown> = {};
  if (item.imaging.body_region) meta.body_region = item.imaging.body_region;
  if (item.imaging.contrast) meta.contrast = item.imaging.contrast;
  if (item.imaging.indication) meta.indication = item.imaging.indication;
  if (item.imaging.observations) meta.observations = item.imaging.observations;
  return meta;
}

export function describeItemMetadata(metadata: Record<string, unknown> | null | undefined): string[] {
  if (!metadata) return [];
  const out: string[] = [];
  if (typeof metadata.body_region === "string") out.push(`Región: ${metadata.body_region}`);
  if (typeof metadata.contrast === "string" && metadata.contrast in IMAGING_CONTRAST_LABELS) {
    out.push(IMAGING_CONTRAST_LABELS[metadata.contrast as ImagingContrast]);
  }
  if (typeof metadata.indication === "string") out.push(`Indicación: ${metadata.indication}`);
  if (typeof metadata.observations === "string") out.push(`Obs.: ${metadata.observations}`);
  return out;
}

export function categoryLabel(category: MedicalOrderCategory | null | undefined): string {
  return category ? MEDICAL_ORDER_CATEGORY_LABELS[category] : "Orden médica";
}

export function isValidVerificationToken(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}

export function buildMedicalOrderVerifyUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${MEDICAL_ORDER_VERIFY_PATH}/${token}`;
}

export function computeAge(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const d = new Date(`${birthDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function formatDateAr(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function formatDateTimeAr(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

const DB_ERROR_MESSAGES: Record<string, string> = {
  MEDICAL_ORDER_ISSUER_MISMATCH:
    "Solo el profesional titular puede emitir la orden con su matrícula. Vinculá tu usuario a un perfil profesional.",
  MEDICAL_ORDER_PROFESSIONAL_INVALID: "El profesional no pertenece a este consultorio.",
  MEDICAL_ORDER_PATIENT_INVALID: "El paciente no pertenece a este consultorio.",
  MEDICAL_ORDER_IMMUTABLE: "La orden ya fue emitida y no puede modificarse. Solo puede anularse.",
  MEDICAL_ORDER_VOID_REASON_REQUIRED: "Indicá el motivo de la anulación.",
  MEDICAL_ORDER_DELETE_FORBIDDEN: "Las órdenes emitidas no se eliminan; se anulan.",
  MEDICAL_ORDER_INVALID_STATUS: "Estado de orden inválido.",
  MEDICAL_ORDER_CATEGORY_IMMUTABLE: "No se puede cambiar el tipo de una orden existente.",
};

/** Maps DB trigger errors to user-facing Spanish messages (never leaks SQL details). */
export function mapMedicalOrderDbError(message: string | null | undefined): string {
  if (!message) return "No se pudo guardar la orden.";
  for (const [code, text] of Object.entries(DB_ERROR_MESSAGES)) {
    if (message.includes(code)) return text;
  }
  if (message.includes("row-level security")) return "Sin permisos para esta operación.";
  return "No se pudo guardar la orden.";
}

/** True when the DB has not been migrated yet (e.g. environments without the v2 schema). */
export function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    /does not exist|Could not find/i.test(error.message ?? "")
  );
}
