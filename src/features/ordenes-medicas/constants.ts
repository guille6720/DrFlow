export const MEDICAL_ORDER_CATEGORIES = [
  "laboratorio",
  "imagenes",
  "interconsulta",
  "practica",
  "kinesiologia",
  "psicologia",
  "dispositivo",
  "otra",
] as const;

export type MedicalOrderCategory = (typeof MEDICAL_ORDER_CATEGORIES)[number];

export const MEDICAL_ORDER_CATEGORY_LABELS: Record<MedicalOrderCategory, string> = {
  laboratorio: "Laboratorio",
  imagenes: "Diagnóstico por imágenes",
  interconsulta: "Interconsulta",
  practica: "Práctica médica",
  kinesiologia: "Kinesiología",
  psicologia: "Psicología / Psicoterapia",
  dispositivo: "Dispositivo / Insumo",
  otra: "Otra práctica",
};

/** Legacy `order_type` column kept in sync so older screens keep working. */
export const MEDICAL_ORDER_CATEGORY_LEGACY_TYPE: Record<MedicalOrderCategory, "study" | "referral"> = {
  laboratorio: "study",
  imagenes: "study",
  interconsulta: "referral",
  practica: "study",
  kinesiologia: "referral",
  psicologia: "referral",
  dispositivo: "study",
  otra: "study",
};

export const MEDICAL_ORDER_PRIORITIES = ["normal", "preferente", "urgente"] as const;
export type MedicalOrderPriority = (typeof MEDICAL_ORDER_PRIORITIES)[number];

export const MEDICAL_ORDER_PRIORITY_LABELS: Record<MedicalOrderPriority, string> = {
  normal: "Normal",
  preferente: "Preferente",
  urgente: "Urgente",
};

export const IMAGING_CONTRAST_OPTIONS = ["con", "sin", "no_aplica"] as const;
export type ImagingContrast = (typeof IMAGING_CONTRAST_OPTIONS)[number];

export const IMAGING_CONTRAST_LABELS: Record<ImagingContrast, string> = {
  con: "Con contraste",
  sin: "Sin contraste",
  no_aplica: "No aplica",
};

export type MedicalOrderStatusV2 = "draft" | "issued" | "void";

export const MEDICAL_ORDER_STATUS_LABELS: Record<MedicalOrderStatusV2, string> = {
  draft: "Borrador",
  issued: "Emitida",
  void: "ANULADA",
};

export const MEDICAL_ORDER_AUDIT_EVENTS = {
  created: "MEDICAL_ORDER_CREATED",
  viewed: "MEDICAL_ORDER_VIEWED",
  pdfGenerated: "MEDICAL_ORDER_PDF_GENERATED",
  shared: "MEDICAL_ORDER_SHARED",
  cancelled: "MEDICAL_ORDER_CANCELLED",
} as const;

export type MedicalOrderClientEvent = "viewed" | "pdf" | "print" | "copy_link" | "whatsapp";

export const MEDICAL_ORDER_VERIFY_PATH = "/verify/medical-order";

/** Default validity (days) suggested in the form; the clinician can change it. */
export const MEDICAL_ORDER_DEFAULT_VALIDITY_DAYS = 30;

export const MEDICAL_ORDER_SIGNATURE_MECHANISM = "nexclinic_internal_validation_v1";

export const MEDICAL_ORDER_SIGNATURE_DISCLAIMER =
  "Validación interna NexClinic. No reemplaza la firma digital ni el registro en plataformas oficiales (ReNaPDiS / CUIR).";
