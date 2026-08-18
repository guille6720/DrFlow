export const PATIENT_IMPORT_FIELDS = [
  "document_number",
  "last_name",
  "first_name",
  "birth_date",
  "phone",
  "email",
  "address",
  "insurance_provider",
  "insurance_plan",
  "insurance_number",
  "emergency_contact_name",
  "emergency_contact_phone",
] as const;

export type PatientImportField = (typeof PATIENT_IMPORT_FIELDS)[number];

export type PatientColumnMapping = Partial<Record<PatientImportField, string>>;

export const PATIENT_IMPORT_FIELD_LABELS: Record<PatientImportField, string> = {
  document_number: "DNI / documento",
  last_name: "Apellido",
  first_name: "Nombre",
  birth_date: "Fecha de nacimiento",
  phone: "Teléfono",
  email: "Email",
  address: "Dirección",
  insurance_provider: "Obra social / cobertura",
  insurance_plan: "Plan",
  insurance_number: "Nº de afiliado",
  emergency_contact_name: "Contacto de emergencia",
  emergency_contact_phone: "Tel. emergencia",
};

export const PATIENT_IMPORT_REQUIRED_FIELDS: PatientImportField[] = [
  "document_number",
  "last_name",
  "first_name",
];

const HEADER_ALIASES: Record<string, PatientImportField> = {
  dni: "document_number",
  documento: "document_number",
  documentodni: "document_number",
  nrodocumento: "document_number",
  ndocumento: "document_number",
  document_number: "document_number",
  identification: "document_number",
  apellido: "last_name",
  apellidos: "last_name",
  lastname: "last_name",
  last_name: "last_name",
  nombre: "first_name",
  nombres: "first_name",
  firstname: "first_name",
  first_name: "first_name",
  nacimiento: "birth_date",
  fechanacimiento: "birth_date",
  fecha_nacimiento: "birth_date",
  birth_date: "birth_date",
  dob: "birth_date",
  celular: "phone",
  telefono: "phone",
  tel: "phone",
  phones: "phone",
  phone: "phone",
  mail: "email",
  correo: "email",
  emails: "email",
  email: "email",
  domicilio: "address",
  direccion: "address",
  address: "address",
  cobertura: "insurance_provider",
  obrasocial: "insurance_provider",
  obra_social: "insurance_provider",
  financiers: "insurance_provider",
  insurance: "insurance_provider",
  insurance_provider: "insurance_provider",
  plan: "insurance_plan",
  insurance_plan: "insurance_plan",
  afiliado: "insurance_number",
  nroafiliado: "insurance_number",
  insurance_number: "insurance_number",
  contactoemergencia: "emergency_contact_name",
  emergency_contact_name: "emergency_contact_name",
  telememergencia: "emergency_contact_phone",
  emergency_contact_phone: "emergency_contact_phone",
};

export function normalizeHeaderKey(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function suggestPatientColumnMapping(headers: string[]): PatientColumnMapping {
  const mapping: PatientColumnMapping = {};
  const used = new Set<string>();

  for (const header of headers) {
    const field = HEADER_ALIASES[normalizeHeaderKey(header)];
    if (!field || mapping[field]) continue;
    mapping[field] = header;
    used.add(header);
  }

  return mapping;
}

export const BUILTIN_MAPPING_PRESETS: Array<{
  id: string;
  name: string;
  aliases: string[];
}> = [
  { id: "pami", name: "PAMI", aliases: ["pami", "inssjp"] },
  { id: "osde", name: "OSDE", aliases: ["osde"] },
  { id: "swiss", name: "Swiss Medical", aliases: ["swiss", "swmed"] },
  { id: "consumers", name: "Sistema médico anterior", aliases: ["consumers", "firstname", "identification"] },
  { id: "custom", name: "Planilla personalizada", aliases: [] },
];

export function suggestPresetFromHeaders(headers: string[]): string {
  const blob = headers.map(normalizeHeaderKey).join(" ");
  if (blob.includes("firstname") && blob.includes("identification")) return "consumers";
  if (blob.includes("pami")) return "pami";
  if (blob.includes("osde")) return "osde";
  if (blob.includes("swiss")) return "swiss";
  return "custom";
}

export function mappingSourceHeaders(mapping: PatientColumnMapping): string[] {
  return Object.values(mapping).filter((value): value is string => Boolean(value));
}

export function scoreMappingAgainstHeaders(
  mapping: PatientColumnMapping,
  headers: string[]
): number {
  const headerSet = new Set(headers.map(normalizeHeaderKey));
  const mapped = mappingSourceHeaders(mapping);
  if (mapped.length === 0) return 0;
  const hits = mapped.filter((header) => headerSet.has(normalizeHeaderKey(header))).length;
  return hits / mapped.length;
}

export function requiredMappingHeadersPresent(
  mapping: PatientColumnMapping,
  headers: string[]
): boolean {
  const headerSet = new Set(headers.map(normalizeHeaderKey));
  return PATIENT_IMPORT_REQUIRED_FIELDS.every((field) => {
    const source = mapping[field];
    return Boolean(source && headerSet.has(normalizeHeaderKey(source)));
  });
}

export function remapTemplateToHeaders(
  mapping: PatientColumnMapping,
  headers: string[]
): PatientColumnMapping {
  const byKey = new Map(headers.map((header) => [normalizeHeaderKey(header), header]));
  const next: PatientColumnMapping = {};
  for (const field of PATIENT_IMPORT_FIELDS) {
    const source = mapping[field];
    if (!source) continue;
    const match = byKey.get(normalizeHeaderKey(source));
    if (match) next[field] = match;
  }
  return next;
}

export type ImportTemplateCandidate = {
  id: string;
  name: string;
  mapping: PatientColumnMapping;
  date_format: string | null;
  last_used_at?: string | null;
};

export function pickCompatibleTemplate(
  templates: ImportTemplateCandidate[],
  headers: string[],
  minScore = 0.75
): ImportTemplateCandidate | null {
  let best: ImportTemplateCandidate | null = null;
  let bestScore = -1;
  let bestUsed = "";

  for (const template of templates) {
    if (!requiredMappingHeadersPresent(template.mapping, headers)) continue;
    const score = scoreMappingAgainstHeaders(template.mapping, headers);
    if (score < minScore) continue;
    const used = template.last_used_at ?? "";
    if (!best || score > bestScore || (score === bestScore && used > bestUsed)) {
      best = template;
      bestScore = score;
      bestUsed = used;
    }
  }

  return best;
}
