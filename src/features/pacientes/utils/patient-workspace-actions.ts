import {
  DEFAULT_PATIENT_WORKSPACE_TAB,
  type PatientWorkspaceTabId,
} from "@/features/pacientes/constants/patient-workspace-tabs";

export type PatientWorkspaceAction = "nueva" | "upload" | "alta" | "certificado" | "cerrar" | "estudio" | "copilot";
export type PatientWorkspaceMode = "edit" | "view";
export type PatientWorkspaceSheet = "receta" | "orden" | "archivo";
export type PatientWorkspaceFocus = "diagnostico" | "tratamiento" | "vitales" | "evolucion";

export type PatientWorkspaceUrlOptions = {
  tab?: PatientWorkspaceTabId;
  action?: PatientWorkspaceAction;
  record?: string;
  mode?: PatientWorkspaceMode;
  appointment?: string;
  professional?: string;
  consulta?: string;
  sheet?: PatientWorkspaceSheet;
  focus?: PatientWorkspaceFocus;
};

/** Build a patient workspace URL with optional sheet/query state. */
export function buildPatientWorkspaceUrl(
  patientId: string,
  opts: PatientWorkspaceUrlOptions = {}
): string {
  const tab = opts.tab ?? DEFAULT_PATIENT_WORKSPACE_TAB;
  const params = new URLSearchParams();

  const hasSheetState =
    opts.action != null ||
    opts.record != null ||
    opts.mode != null ||
    opts.appointment != null ||
    opts.professional != null ||
    opts.consulta != null ||
    opts.sheet != null ||
    opts.focus != null;

  if (tab !== DEFAULT_PATIENT_WORKSPACE_TAB || hasSheetState) {
    params.set("tab", tab);
  }
  if (opts.action) params.set("action", opts.action);
  if (opts.record) params.set("record", opts.record);
  if (opts.mode) params.set("mode", opts.mode);
  if (opts.appointment) params.set("appointment", opts.appointment);
  if (opts.professional) params.set("professional", opts.professional);
  if (opts.consulta) params.set("consulta", opts.consulta);
  if (opts.sheet) params.set("sheet", opts.sheet);
  if (opts.focus) params.set("focus", opts.focus);

  const qs = params.toString();
  return qs ? `/pacientes/${patientId}?${qs}` : `/pacientes/${patientId}`;
}

/** Abre la HC con evolución inline (misma UX que Pacientes → HC → nueva consulta). */
export function buildAppointmentConsultationUrl(
  patientId: string,
  opts: { appointmentId: string; professionalId: string }
): string {
  return buildPatientWorkspaceUrl(patientId, {
    tab: "soap",
    action: "nueva",
    appointment: opts.appointmentId,
    professional: opts.professionalId,
  });
}

export type ParsedPatientWorkspaceActions = {
  action: PatientWorkspaceAction | null;
  record: string | null;
  mode: PatientWorkspaceMode | null;
  appointment: string | null;
  professional: string | null;
  consulta: string | null;
  sheet: PatientWorkspaceSheet | null;
  focus: PatientWorkspaceFocus | null;
  consultSheetOpen: boolean;
  inlineConsultOpen: boolean;
  prescriptionSheetOpen: boolean;
  orderSheetOpen: boolean;
  archivoSheetOpen: boolean;
  recordSheetOpen: boolean;
  dischargeSheetOpen: boolean;
  certificateSheetOpen: boolean;
  closeEncounterSheetOpen: boolean;
  labInterpretSheetOpen: boolean;
  copilotSheetOpen: boolean;
};

export function parsePatientWorkspaceActions(
  tab: PatientWorkspaceTabId,
  searchParams: URLSearchParams
): ParsedPatientWorkspaceActions {
  const action = searchParams.get("action") as PatientWorkspaceAction | null;
  const record = searchParams.get("record");
  const mode = searchParams.get("mode") as PatientWorkspaceMode | null;
  const appointment = searchParams.get("appointment");
  const professional = searchParams.get("professional");
  const consulta = searchParams.get("consulta");
  const sheet = searchParams.get("sheet") as PatientWorkspaceSheet | null;
  const focus = searchParams.get("focus") as PatientWorkspaceFocus | null;
  const inlineConsult = action === "nueva" && tab === "soap";

  return {
    action,
    record,
    mode,
    appointment,
    professional,
    consulta,
    sheet,
    focus,
    consultSheetOpen: false,
    inlineConsultOpen: inlineConsult,
    prescriptionSheetOpen:
      (action === "nueva" && tab === "recetas") ||
      (inlineConsult && sheet === "receta"),
    orderSheetOpen:
      (action === "nueva" && tab === "ordenes") ||
      (inlineConsult && sheet === "orden"),
    archivoSheetOpen: inlineConsult && sheet === "archivo",
    recordSheetOpen: Boolean(record && tab === "soap" && action !== "nueva"),
    dischargeSheetOpen: action === "alta",
    certificateSheetOpen: action === "certificado",
    closeEncounterSheetOpen: action === "cerrar",
    labInterpretSheetOpen: action === "estudio",
    copilotSheetOpen: action === "copilot",
  };
}
