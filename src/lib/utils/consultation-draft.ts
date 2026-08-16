export type ConsultationDraftContext = {
  patientId: string;
  appointmentId?: string;
  professionalId?: string;
  /** Consulta existente en edición (vuelve a /historias/[id]/editar). */
  recordId?: string;
};

/** Borrador local de la consulta en curso (sessionStorage). */
export type ConsultationDraftPayload = {
  v: 1;
  evolution: string;
  chiefComplaint: string;
  diagnosis: string;
  indications: string;
  vitals: string;
  /** ID del clinical_record ya persistido (autosave / edición). */
  recordId?: string | null;
  updatedAt: string;
};

const QUERY_FLAG = "consulta";
const DRAFT_VERSION = 1 as const;

export function consultationDraftKey(ctx: ConsultationDraftContext): string {
  if (ctx.recordId) {
    return `drflow-consultation-evolution-record-${ctx.recordId}`;
  }
  if (ctx.appointmentId) {
    return `drflow-consultation-evolution-appt-${ctx.appointmentId}`;
  }
  return `drflow-consultation-evolution-patient-${ctx.patientId}`;
}

function emptyPayload(): ConsultationDraftPayload {
  return {
    v: DRAFT_VERSION,
    evolution: "",
    chiefComplaint: "",
    diagnosis: "",
    indications: "",
    vitals: "",
    recordId: null,
    updatedAt: new Date().toISOString(),
  };
}

export function readConsultationDraft(key: string): ConsultationDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as ConsultationDraftPayload;
      if (parsed && parsed.v === 1) return parsed;
    }
    // Formato legacy: solo texto de evolución.
    return {
      ...emptyPayload(),
      evolution: raw,
    };
  } catch {
    return null;
  }
}

/** @deprecated Prefer readConsultationDraft — mantiene compat con callers legacy. */
export function readConsultationEvolution(key: string): string {
  return readConsultationDraft(key)?.evolution ?? "";
}

export function saveConsultationDraft(key: string, payload: ConsultationDraftPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ...payload,
        v: DRAFT_VERSION,
        updatedAt: new Date().toISOString(),
      } satisfies ConsultationDraftPayload)
    );
  } catch {
    /* quota / private mode */
  }
}

export function saveConsultationEvolution(key: string, text: string): void {
  const prev = readConsultationDraft(key) ?? emptyPayload();
  saveConsultationDraft(key, { ...prev, evolution: text });
}

export function appendToConsultationEvolution(key: string, line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return readConsultationEvolution(key);
  const current = readConsultationEvolution(key).trim();
  const next = current ? `${current}\n${trimmed}` : trimmed;
  saveConsultationEvolution(key, next);
  return next;
}

export function clearConsultationEvolution(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function parseConsultationDraftContext(
  params: URLSearchParams | { get(name: string): string | null }
): ConsultationDraftContext | null {
  if (params.get(QUERY_FLAG) !== "1") return null;
  const patientId = params.get("patient")?.trim();
  if (!patientId) return null;
  const appointmentId = params.get("appointment")?.trim() || undefined;
  const professionalId = params.get("professional")?.trim() || undefined;
  const recordId = params.get("record")?.trim() || undefined;
  return { patientId, appointmentId, professionalId, recordId };
}

export function buildConsultaHref(ctx: ConsultationDraftContext): string {
  if (ctx.recordId) {
    return `/historias/${ctx.recordId}/editar`;
  }
  const params = new URLSearchParams();
  if (ctx.appointmentId) params.set("appointment", ctx.appointmentId);
  params.set("patient", ctx.patientId);
  if (ctx.professionalId) params.set("professional", ctx.professionalId);
  const qs = params.toString();
  return qs ? `/historias/nueva?${qs}` : "/historias/nueva";
}

export function buildPharmacologyHrefFromConsultation(
  ctx: ConsultationDraftContext,
  mode?: "symptoms" | "pathology" | "vademecum"
): string {
  const params = new URLSearchParams();
  params.set(QUERY_FLAG, "1");
  params.set("patient", ctx.patientId);
  if (ctx.appointmentId) params.set("appointment", ctx.appointmentId);
  if (ctx.professionalId) params.set("professional", ctx.professionalId);
  if (ctx.recordId) params.set("record", ctx.recordId);
  if (mode && mode !== "pathology") params.set("mode", mode);
  return `/herramientas/farmacologia?${params.toString()}`;
}

export function buildRecetasHrefFromConsultation(
  ctx: ConsultationDraftContext,
  tab: "receta" | "orden" = "receta"
): string {
  const params = new URLSearchParams();
  params.set(QUERY_FLAG, "1");
  params.set("patient", ctx.patientId);
  if (ctx.appointmentId) params.set("appointment", ctx.appointmentId);
  if (ctx.professionalId) params.set("professional", ctx.professionalId);
  if (ctx.recordId) params.set("record", ctx.recordId);
  if (tab === "orden") params.set("tipo", "orden");
  return `/recetas?${params.toString()}`;
}

export function formatGuideDrugForEvolution(input: {
  name: string;
  activeIngredient?: string | null;
  presentation?: string | null;
  dosageReference?: string | null;
}): string {
  const generic = input.activeIngredient?.trim() || input.name.trim();
  const brand =
    input.activeIngredient &&
    input.name.trim().toLowerCase() !== input.activeIngredient.trim().toLowerCase()
      ? input.name.trim()
      : null;
  const parts = [brand ? `${generic} (${brand})` : generic];
  if (input.presentation?.trim()) parts.push(input.presentation.trim());
  if (input.dosageReference?.trim()) parts.push(`Dosis ref.: ${input.dosageReference.trim()}`);
  return `• ${parts.join(" — ")}`;
}

export function formatVademecumForEvolution(item: {
  brand_name: string;
  active_ingredient: string;
  presentation: string;
}): string {
  return `• ${item.active_ingredient} — ${item.brand_name} — ${item.presentation}`;
}

export function pathologyDrugToEvolutionLine(pd: {
  dosage_reference?: string | null;
  drugs:
    | {
        name: string;
        active_ingredient: string;
        presentation?: string | null;
      }
    | {
        name: string;
        active_ingredient: string;
        presentation?: string | null;
      }[]
    | null;
}): string | null {
  const drug = Array.isArray(pd.drugs) ? pd.drugs[0] : pd.drugs;
  if (!drug) return null;
  return formatGuideDrugForEvolution({
    name: drug.name,
    activeIngredient: drug.active_ingredient,
    presentation: drug.presentation,
    dosageReference: pd.dosage_reference,
  });
}
