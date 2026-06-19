export interface ExtractedPatientInfo {
  document_number: string;
  first_name: string;
  last_name: string;
  source: "filename" | "pdf_text" | "combined";
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeDni(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 8) return null;
  return digits;
}

function splitFullName(full: string): { first_name: string; last_name: string } {
  const cleaned = full.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return { first_name: "Importado", last_name: "Sin nombre" };
  }

  if (cleaned.includes(",")) {
    const [last, ...rest] = cleaned.split(",");
    const first = rest.join(",").trim();
    return {
      first_name: titleCase(first || "Importado"),
      last_name: titleCase(last.trim() || "Sin apellido"),
    };
  }

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return { first_name: "Importado", last_name: titleCase(parts[0]) };
  }

  return {
    last_name: titleCase(parts[0]),
    first_name: titleCase(parts.slice(1).join(" ")),
  };
}

function buildFromDniOnly(dni: string): ExtractedPatientInfo {
  return {
    document_number: dni,
    first_name: "Importado",
    last_name: `DNI ${dni}`,
    source: "filename",
  };
}

export function extractPatientFromFileName(fileName: string): ExtractedPatientInfo | null {
  const base = fileName.split(/[/\\]/).pop()?.replace(/\.pdf$/i, "") ?? "";

  const underscoreMatch = base.match(
    /^([A-Za-zÁÉÍÓÚáéíóúÑñ]+)[_\s-]+([A-Za-zÁÉÍÓÚáéíóúÑñ]+)[_\s-]+(\d{7,8})$/i
  );
  if (underscoreMatch) {
    const dni = normalizeDni(underscoreMatch[3]);
    if (dni) {
      return {
        document_number: dni,
        last_name: titleCase(underscoreMatch[1]),
        first_name: titleCase(underscoreMatch[2]),
        source: "filename",
      };
    }
  }

  const dniNameMatch = base.match(/^(\d{7,8})[\s._-]+(.+)$/i);
  if (dniNameMatch) {
    const dni = normalizeDni(dniNameMatch[1]);
    const name = splitFullName(dniNameMatch[2].replace(/[_-]+/g, " "));
    if (dni) {
      return { document_number: dni, ...name, source: "filename" };
    }
  }

  const nameDniMatch = base.match(/^(.+?)[\s._-]+(\d{7,8})$/i);
  if (nameDniMatch) {
    const dni = normalizeDni(nameDniMatch[2]);
    const name = splitFullName(nameDniMatch[1].replace(/[_-]+/g, " "));
    if (dni) {
      return { document_number: dni, ...name, source: "filename" };
    }
  }

  const dniOnly = base.match(/^(\d{7,8})$/);
  if (dniOnly) {
    const dni = normalizeDni(dniOnly[1]);
    if (dni) return buildFromDniOnly(dni);
  }

  const anyDni = base.match(/(?:^|[^\d])(\d{7,8})(?:[^\d]|$)/);
  if (anyDni) {
    const dni = normalizeDni(anyDni[1]);
    if (dni) {
      const namePart = base.replace(anyDni[1], " ").replace(/[_-]+/g, " ").trim();
      if (namePart.length >= 3) {
        const name = splitFullName(namePart);
        return { document_number: dni, ...name, source: "filename" };
      }
      return buildFromDniOnly(dni);
    }
  }

  return null;
}

export function extractPatientFromPdfText(text: string): ExtractedPatientInfo | null {
  const normalized = text.replace(/\r/g, "\n");
  let document_number: string | null = null;

  const dniPatterns = [
    /DNI\s*(?:N[°º.]?\s*)?[:\s]*(\d{2}\.?\d{3}\.?\d{3}|\d{7,8})/i,
    /Documento\s*(?:N[°º.]?\s*)?[:\s]*(\d{2}\.?\d{3}\.?\d{3}|\d{7,8})/i,
    /\bN[°º]\s*de\s*documento[:\s]*(\d{7,8})/i,
  ];

  for (const pattern of dniPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      document_number = normalizeDni(match[1]);
      if (document_number) break;
    }
  }

  if (!document_number) {
    const fallback = normalized.match(/\b(\d{2}\.\d{3}\.\d{3})\b/);
    if (fallback) document_number = normalizeDni(fallback[1]);
  }

  if (!document_number) return null;

  let first_name = "";
  let last_name = "";

  const namePatterns = [
    /Apellido\s*y\s*nombre[:\s]*([^\n]{3,80})/i,
    /Paciente[:\s]*([^\n]{3,80})/i,
    /Nombre\s*y\s*apellido[:\s]*([^\n]{3,80})/i,
    /Apellido[:\s]*([A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)[\n\r]+Nombre[:\s]*([A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)/i,
    /Nombre[:\s]*([A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)[\n\r]+Apellido[:\s]*([A-Za-zÁÉÍÓÚáéíóúÑñ\s]+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    if (match.length === 2) {
      const split = splitFullName(match[1]);
      first_name = split.first_name;
      last_name = split.last_name;
      break;
    }
    if (match.length === 3) {
      if (/^Nombre/i.test(pattern.source)) {
        first_name = titleCase(match[1].trim());
        last_name = titleCase(match[2].trim());
      } else {
        last_name = titleCase(match[1].trim());
        first_name = titleCase(match[2].trim());
      }
      break;
    }
  }

  if (!first_name || !last_name) {
    return buildFromDniOnly(document_number);
  }

  return {
    document_number,
    first_name,
    last_name,
    source: "pdf_text",
  };
}

export function mergePatientExtract(
  fromFileName: ExtractedPatientInfo | null,
  fromPdf: ExtractedPatientInfo | null
): ExtractedPatientInfo | null {
  if (!fromFileName && !fromPdf) return null;
  if (!fromFileName) return fromPdf;
  if (!fromPdf) return fromFileName;

  const sameDni = fromFileName.document_number === fromPdf.document_number;
  const filenameHasRealName =
    fromFileName.first_name !== "Importado" && fromFileName.last_name !== `DNI ${fromFileName.document_number}`;
  const pdfHasRealName =
    fromPdf.first_name !== "Importado" && fromPdf.last_name !== `DNI ${fromPdf.document_number}`;

  if (sameDni) {
    if (pdfHasRealName && !filenameHasRealName) {
      return { ...fromPdf, source: "combined" };
    }
    if (filenameHasRealName) {
      return { ...fromFileName, source: "combined" };
    }
    return { ...fromFileName, source: "combined" };
  }

  if (pdfHasRealName) return fromPdf;
  if (filenameHasRealName) return fromFileName;
  return fromPdf ?? fromFileName;
}
