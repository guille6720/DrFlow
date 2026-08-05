import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  buildPatientFilePath,
  isJpegBuffer,
  isPdfBuffer,
  isPngBuffer,
  isZipBuffer,
  looksLikeTextCsv,
  sanitizeStorageFileName,
  validateAdminDocumentUpload,
  validateCsvImportUpload,
  validatePdfUpload,
  validateSpreadsheetImportUpload,
} from "@/core/security/file-upload";

const ROOT = process.cwd();

function mockFile(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

describe("file upload security helpers", () => {
  it("detects PDF magic bytes", () => {
    expect(isPdfBuffer(Buffer.from("%PDF-1.4\n"))).toBe(true);
    expect(isPdfBuffer(Buffer.from("not-a-pdf"))).toBe(false);
  });

  it("detects JPEG and PNG magic bytes", () => {
    expect(isJpegBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(
      isPngBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe(true);
  });

  it("detects ZIP/XLSX magic bytes", () => {
    expect(isZipBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
  });

  it("sanitizes path traversal in file names", () => {
    expect(sanitizeStorageFileName("../../etc/passwd")).not.toContain("/");
    expect(sanitizeStorageFileName("doc<script>.pdf")).toBe("doc_script_.pdf");
  });

  it("builds tenant-scoped storage paths with UUID prefix", () => {
    const path = buildPatientFilePath("clinic-1", "patient-1", "doc.pdf", "admin");
    expect(path).toMatch(/^clinic-1\/patient-1\/admin\/[0-9a-f-]+-doc\.pdf$/);
  });

  it("rejects spoofed PDF uploads", () => {
    const buffer = Buffer.from("<html>evil</html>");
    const file = mockFile("evil.pdf", "application/pdf", buffer.length);
    const result = validatePdfUpload(file, buffer, 1024 * 1024);
    expect(result.ok).toBe(false);
  });

  it("accepts valid PDF uploads", () => {
    const buffer = Buffer.from("%PDF-1.4 test");
    const file = mockFile("historia.pdf", "application/pdf", buffer.length);
    const result = validatePdfUpload(file, buffer, 1024 * 1024);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contentType).toBe("application/pdf");
  });

  it("validates admin documents by content not client MIME", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const file = mockFile("scan.jpg", "application/pdf", jpeg.length);
    const result = validateAdminDocumentUpload(file, jpeg, 1024 * 1024);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contentType).toBe("image/jpeg");
  });

  it("validates CSV as text without null bytes", () => {
    const buffer = Buffer.from("dni,nombre\n123,Ana");
    const file = mockFile("data.csv", "text/csv", buffer.length);
    expect(looksLikeTextCsv(buffer)).toBe(true);
    expect(validateCsvImportUpload(file, buffer, 1024 * 1024).ok).toBe(true);
    expect(looksLikeTextCsv(Buffer.from([0x00, 0x01]))).toBe(false);
  });

  it("validates spreadsheet extensions and zip signature for xlsx", () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    const file = mockFile("consumers.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", zip.length);
    expect(validateSpreadsheetImportUpload(file, zip, 1024 * 1024).ok).toBe(true);
  });
});

describe("file upload audit static checks", () => {
  const uploadActions = [
    "src/features/pacientes/actions/patient-attachments.ts",
    "src/lib/actions/admin-documents.ts",
    "src/lib/actions/import-jobs.ts",
    "src/lib/actions/hce-import.ts",
    "src/lib/actions/patient-import.ts",
    "src/lib/actions/clinical-import.helpers.ts",
    "src/lib/server/process-clinical-pdf-import.ts",
  ];

  it("upload handlers use centralized file-upload validators", () => {
    for (const rel of uploadActions) {
      const content = readFileSync(resolve(ROOT, rel), "utf8");
      expect(content).toMatch(/@\/core\/security\/file-upload/);
      expect(content).not.toMatch(/file\.type \|\| "application\/pdf"/);
    }
  });

  it("clinical bucket migration allows admin image MIME types", () => {
    const sql = readFileSync(
      resolve(ROOT, "supabase/migrations/059_file_upload_hardening.sql"),
      "utf8"
    );
    expect(sql).toMatch(/image\/jpeg/);
    expect(sql).toMatch(/image\/png/);
  });

  it("storage access uses signed URLs not public buckets", () => {
    const sql028 = readFileSync(
      resolve(ROOT, "supabase/migrations/028_clinical_files_storage.sql"),
      "utf8"
    );
    expect(sql028).toMatch(/public\s*=\s*false/);

    const srcRoot = resolve(ROOT, "src");
    const publicUrlOffenders: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
        const content = readFileSync(full, "utf8");
        if (content.includes(".getPublicUrl(")) {
          publicUrlOffenders.push(full.replace(ROOT, ""));
        }
      }
    }

    walk(srcRoot);
    expect(publicUrlOffenders).toEqual([]);
  });

  it("download handlers require clinic permission and signed URLs", () => {
    for (const rel of [
      "src/features/pacientes/actions/patient-attachments.ts",
      "src/lib/actions/admin-documents.ts",
    ]) {
      const content = readFileSync(resolve(ROOT, rel), "utf8");
      expect(content).toMatch(/createSignedUrl/);
      expect(content).toMatch(/eq\("clinic_id"/);
    }
  });
});
