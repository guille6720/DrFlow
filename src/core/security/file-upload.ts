import { randomUUID } from "crypto";

const PDF_SIGNATURE = "%PDF-";

export type UploadValidationResult =
  | { ok: true; sanitizedName: string; contentType: string }
  | { ok: false; error: string };

/** Strip path segments and unsafe characters from a client-provided file name. */
export function sanitizeStorageFileName(name: string, defaultBase = "archivo"): string {
  const base = (name.split(/[/\\]/).pop() ?? defaultBase).trim();
  let cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
  if (!cleaned || cleaned === "." || cleaned === "..") cleaned = defaultBase;
  if (cleaned.length > 180) {
    const dot = cleaned.lastIndexOf(".");
    const ext = dot > 0 ? cleaned.slice(dot) : "";
    cleaned = cleaned.slice(0, 180 - ext.length) + ext;
  }
  return cleaned;
}

export function ensureExtension(fileName: string, ext: string): string {
  const normalized = ext.startsWith(".") ? ext : `.${ext}`;
  return fileName.toLowerCase().endsWith(normalized) ? fileName : `${fileName}${normalized}`;
}

export function buildPatientFilePath(
  clinicId: string,
  patientId: string,
  fileName: string,
  zone: "clinical" | "admin" = "clinical",
  options?: { clinicalRecordId?: string | null }
): string {
  const safe = sanitizeStorageFileName(fileName);
  if (zone === "admin") {
    return `${clinicId}/${patientId}/admin/${randomUUID()}-${safe}`;
  }
  const consultationId = options?.clinicalRecordId?.trim();
  if (consultationId) {
    return `${clinicId}/patients/${patientId}/consultations/${consultationId}/${randomUUID()}-${safe}`;
  }
  return `${clinicId}/patients/${patientId}/${randomUUID()}-${safe}`;
}

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === PDF_SIGNATURE;
}

export function isJpegBuffer(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export function isPngBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

export function isZipBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  );
}

/** Rejects obvious binary payloads masquerading as CSV. */
export function looksLikeTextCsv(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  for (const byte of sample) {
    if (byte === 0) return false;
  }
  return sample.length > 0;
}

function maxMbError(maxBytes: number): string {
  return `El archivo no puede superar ${Math.round(maxBytes / (1024 * 1024))} MB`;
}

export function validatePdfUpload(
  file: File,
  buffer: Buffer,
  maxBytes: number
): UploadValidationResult {
  if (file.size <= 0) return { ok: false, error: "Archivo vacío" };
  if (file.size > maxBytes) return { ok: false, error: maxMbError(maxBytes) };

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".pdf") && file.type !== "application/pdf") {
    return { ok: false, error: "Solo se permiten archivos PDF" };
  }
  if (!isPdfBuffer(buffer)) {
    return { ok: false, error: "El contenido no es un PDF válido" };
  }

  return {
    ok: true,
    sanitizedName: ensureExtension(
      sanitizeStorageFileName(file.name, "documento.pdf"),
      ".pdf"
    ),
    contentType: "application/pdf",
  };
}

const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

export function buildProfessionalSignaturePath(
  clinicId: string,
  professionalId: string,
  fileName: string
): string {
  const safe = sanitizeStorageFileName(fileName);
  return `${clinicId}/signatures/${professionalId}/${randomUUID()}-${safe}`;
}

export function validateSignatureImageUpload(
  file: File,
  buffer: Buffer,
  maxBytes: number = SIGNATURE_MAX_BYTES
): UploadValidationResult {
  if (file.size <= 0) return { ok: false, error: "Archivo vacío" };
  if (file.size > maxBytes) return { ok: false, error: maxMbError(maxBytes) };

  if (isJpegBuffer(buffer)) {
    return {
      ok: true,
      sanitizedName: ensureExtension(
        sanitizeStorageFileName(file.name, "firma.jpg"),
        ".jpg"
      ),
      contentType: "image/jpeg",
    };
  }
  if (isPngBuffer(buffer)) {
    return {
      ok: true,
      sanitizedName: ensureExtension(
        sanitizeStorageFileName(file.name, "firma.png"),
        ".png"
      ),
      contentType: "image/png",
    };
  }

  const lower = file.name.toLowerCase();
  if (lower.endsWith(".webp") || file.type === "image/webp") {
    return {
      ok: true,
      sanitizedName: ensureExtension(
        sanitizeStorageFileName(file.name, "firma.webp"),
        ".webp"
      ),
      contentType: "image/webp",
    };
  }

  return { ok: false, error: "Solo PNG, JPEG o WebP para la firma" };
}

export function validateAdminDocumentUpload(
  file: File,
  buffer: Buffer,
  maxBytes: number
): UploadValidationResult {
  if (file.size <= 0) return { ok: false, error: "Archivo vacío" };
  if (file.size > maxBytes) return { ok: false, error: maxMbError(maxBytes) };

  if (isPdfBuffer(buffer)) {
    return {
      ok: true,
      sanitizedName: ensureExtension(
        sanitizeStorageFileName(file.name, "documento.pdf"),
        ".pdf"
      ),
      contentType: "application/pdf",
    };
  }
  if (isJpegBuffer(buffer)) {
    return {
      ok: true,
      sanitizedName: ensureExtension(
        sanitizeStorageFileName(file.name, "imagen.jpg"),
        ".jpg"
      ),
      contentType: "image/jpeg",
    };
  }
  if (isPngBuffer(buffer)) {
    return {
      ok: true,
      sanitizedName: ensureExtension(
        sanitizeStorageFileName(file.name, "imagen.png"),
        ".png"
      ),
      contentType: "image/png",
    };
  }

  return { ok: false, error: "Solo PDF, JPEG o PNG" };
}

export function validateCsvImportUpload(
  file: File,
  buffer: Buffer,
  maxBytes: number
): UploadValidationResult {
  if (file.size <= 0) return { ok: false, error: "Archivo vacío" };
  if (file.size > maxBytes) return { ok: false, error: maxMbError(maxBytes) };

  const lower = file.name.toLowerCase();
  const okMime =
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.type === "text/plain" ||
    file.type === "";
  if (!lower.endsWith(".csv") || !okMime) {
    return { ok: false, error: "Solo se permiten archivos CSV (.csv)" };
  }
  if (!looksLikeTextCsv(buffer)) {
    return { ok: false, error: "El contenido no parece un CSV válido" };
  }

  return {
    ok: true,
    sanitizedName: ensureExtension(
      sanitizeStorageFileName(file.name, "import.csv"),
      ".csv"
    ),
    contentType: "text/csv",
  };
}

export function validateSpreadsheetImportUpload(
  file: File,
  buffer: Buffer,
  maxBytes: number
): UploadValidationResult {
  if (file.size <= 0) return { ok: false, error: "Archivo vacío" };
  if (file.size > maxBytes) return { ok: false, error: maxMbError(maxBytes) };

  const lower = file.name.toLowerCase();
  const isCsv = lower.endsWith(".csv") || lower.endsWith(".csv.xlsx");
  const isXlsx = lower.endsWith(".xlsx");
  const isXls = lower.endsWith(".xls");

  if (!isCsv && !isXlsx && !isXls) {
    return {
      ok: false,
      error: "Extensión no permitida. Usá .xlsx, .xls, .csv o .csv.xlsx",
    };
  }

  if (isCsv) {
    if (!looksLikeTextCsv(buffer)) {
      return { ok: false, error: "El contenido no parece un CSV válido" };
    }
    return {
      ok: true,
      sanitizedName: sanitizeStorageFileName(file.name, "consumers.csv"),
      contentType: "text/csv",
    };
  }

  if (!isZipBuffer(buffer)) {
    return { ok: false, error: "El contenido no es un Excel válido" };
  }

  return {
    ok: true,
    sanitizedName: sanitizeStorageFileName(file.name, "consumers.xlsx"),
    contentType: isXls
      ? "application/vnd.ms-excel"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

export function validateJsonImportUpload(
  file: File,
  buffer: Buffer,
  maxBytes: number
): UploadValidationResult {
  if (file.size <= 0) return { ok: false, error: "Archivo vacío" };
  if (file.size > maxBytes) return { ok: false, error: maxMbError(maxBytes) };

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".json") && !lower.endsWith(".fhir.json")) {
    return { ok: false, error: "Solo se permiten archivos JSON FHIR (.json)" };
  }
  if (!looksLikeTextCsv(buffer)) {
    return { ok: false, error: "El contenido no parece JSON de texto" };
  }
  const trimmed = buffer.toString("utf8").trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { ok: false, error: "El JSON FHIR debe ser un objeto o un array" };
  }

  return {
    ok: true,
    sanitizedName: ensureExtension(sanitizeStorageFileName(file.name, "fhir.json"), ".json"),
    contentType: "application/fhir+json",
  };
}
