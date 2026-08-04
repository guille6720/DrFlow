import type {
  PhysicianAssistContext,
  PhysicianAssistItem,
  PhysicianAssistKind,
} from "@/lib/utils/physician-assist-types";

function containsAny(hay: string, terms: string[]): boolean {
  const h = hay.toLowerCase();
  return terms.some((t) => h.includes(t));
}

function textBlob(ctx: PhysicianAssistContext): string {
  return [
    ctx.orderIntentText,
    ctx.evolutionText,
    ctx.diagnosis,
    ctx.chiefComplaint,
    ctx.lastEvolution,
    ctx.lastDiagnosis,
    ctx.medicalHistory,
    ...(ctx.activeProblems ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function stableId(kind: PhysicianAssistKind, seed: string): string {
  return `${kind}-${seed.slice(0, 48).replace(/\s+/g, "-")}`;
}

/** Clinical order panels — Phase C expanded rules (confirm before issuing). */
export const ORDER_PANEL_RULES: Array<{
  id: string;
  label: string;
  terms: string[];
  studies: string[];
  followUp?: string;
}> = [
  {
    id: "diabetes-control",
    label: "Control de diabetes (panel completo)",
    terms: [
      "control de diabetes",
      "control diabetes",
      "diabetes",
      "dm2",
      "dm 2",
      "diabético",
      "diabetico",
      "glicemia",
      "hba1c",
    ],
    studies: [
      "Hemoglobina glicosilada (HbA1c)",
      "Glicemia en ayunas",
      "Perfil lipídico",
      "Microalbuminuria / cociente alb/creat",
      "Creatinina y TFG estimada",
      "Fondo de ojo (retinopatía diabética)",
    ],
    followUp: "Control diabético: repetir HbA1c en 3–6 meses según objetivo terapéutico.",
  },
  {
    id: "hta-control",
    label: "Control de hipertensión",
    terms: ["control hta", "hipertensión", "hta", "presión arterial", "control tensional"],
    studies: [
      "Creatinina y TFG",
      "Ionograma",
      "Perfil lipídico",
      "ECG",
      "Microalbuminuria",
    ],
    followUp: "HTA: verificar PA en consulta y monitoreo domiciliario si disponible.",
  },
  {
    id: "lipid-control",
    label: "Control lipídico",
    terms: ["dislipidemia", "colesterol", "ldl", "perfil lipídico", "estatinas"],
    studies: ["Perfil lipídico completo", "TGO/TGP", "Creatinina"],
    followUp: "Repetir perfil lipídico en 3–6 meses tras ajuste terapéutico.",
  },
  {
    id: "renal-control",
    label: "Control renal",
    terms: ["renal", "creatinina", "irc", "insuficiencia renal", "proteinuria"],
    studies: ["Creatinina", "TFG estimada", "Ionograma", "Microalbuminuria", "Ecografía renal"],
  },
  {
    id: "anemia",
    label: "Estudio de anemia",
    terms: ["anemia", "palidez", "hemoglobina baja", "ferropenia"],
    studies: ["Hemograma completo", "Ferritina", "Transferrina", "Reticulocitos"],
  },
  {
    id: "respiratory",
    label: "Estudio respiratorio",
    terms: ["disnea", "tos", "neumonía", "neumonia", "epoc", "bronquitis"],
    studies: ["Radiografía de tórax PA", "Hemograma", "PCR", "Gasometría si indicada"],
  },
  {
    id: "hepatic-biliary",
    label: "Estudio hepático / biliar",
    terms: ["dolor abdominal", "hepático", "hepatico", "cólico", "colico", "hepatitis"],
    studies: ["Ecografía abdominal", "Hepatograma", "Amilasa/lipasa", "Hemograma"],
  },
];

/** Reference doses — support only, never auto-prescribe. */
export const DOSAGE_HINT_RULES: Array<{ terms: string[]; hint: string }> = [
  {
    terms: ["metformina"],
    hint: "Metformina: habitual 500–850 mg c/12h con comidas (ajustar si TFG <30).",
  },
  {
    terms: ["losartan", "valsartan", "enalapril", "ramipril"],
    hint: "Antihipertensivo (IECA/ARA-II): habitual 1 comprimido c/24h — confirmar dosis según PA y comorbilidades.",
  },
  {
    terms: ["atorvastatina", "rosuvastatina", "simvastatina"],
    hint: "Estatina: habitual dosis nocturna según objetivo LDL (ej. atorvastatina 10–20 mg c/24h).",
  },
  {
    terms: ["amlodipina"],
    hint: "Amlodipina: habitual 5 mg c/24h (máx. 10 mg).",
  },
  {
    terms: ["levotiroxina"],
    hint: "Levotiroxina: individualizar según TSH (habitual 50–100 mcg en ayunas).",
  },
  {
    terms: ["omeprazol", "pantoprazol"],
    hint: "IBP: habitual 20–40 mg c/24h antes del desayuno.",
  },
  {
    terms: ["paracetamol"],
    hint: "Paracetamol: 500–1000 mg c/6–8h (máx. 3–4 g/día).",
  },
  {
    terms: ["ibuprofeno"],
    hint: "Ibuprofeno: 400–600 mg c/8h con comida (máx. corto plazo; revisar renal/GI).",
  },
];

export function isPamiCoverage(ctx: PhysicianAssistContext): boolean {
  const provider = (ctx.insurance ?? "").toLowerCase();
  const plan = (ctx.insurancePlan ?? "").toLowerCase();
  return provider.includes("pami") || plan.includes("pami");
}

export function isObraSocialCoverage(ctx: PhysicianAssistContext): boolean {
  const provider = (ctx.insurance ?? "").toLowerCase();
  if (!provider.trim() || isPamiCoverage(ctx)) return false;
  return (
    provider.includes("osde") ||
    provider.includes("swiss") ||
    provider.includes("galeno") ||
    provider.includes("medicus") ||
    provider.includes("obra social") ||
    provider.includes("prepaga") ||
    Boolean(ctx.insurancePlan?.trim())
  );
}

function matchedOrderPanels(blob: string) {
  return ORDER_PANEL_RULES.filter((rule) => rule.terms.some((t) => blob.includes(t)));
}

/** Expanded order draft from clinical intent (e.g. "control de diabetes"). */
export function buildOrderDraftSuggestion(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const blob = textBlob(ctx);
  if (blob.length < 3) return null;

  const panels = matchedOrderPanels(blob);
  const studies = new Set<string>();

  for (const panel of panels) {
    for (const s of panel.studies) studies.add(s);
  }

  if (studies.size === 0) {
    if (!blob.trim()) return null;
    return {
      id: stableId("order_draft", blob),
      kind: "order_draft",
      title: "Borrador de orden",
      body: `Solicito estudios complementarios acordes a cuadro clínico:\n• (completar según criterio médico)\n\nContexto: ${(ctx.diagnosis ?? ctx.lastDiagnosis ?? ctx.orderIntentText ?? "—").slice(0, 120)}`,
    };
  }

  const panelLabel = panels[0]?.label ?? "Estudios sugeridos";
  const body = [
    `${panelLabel}:`,
    ...[...studies].map((s) => `• ${s}`),
    "",
    `Motivo: ${(ctx.diagnosis ?? ctx.orderIntentText ?? ctx.lastEvolution ?? "evaluación clínica").slice(0, 200)}`,
    "",
    "Confirmar estudios y cobertura antes de emitir la orden.",
  ].join("\n");

  return {
    id: stableId("order_draft", body),
    kind: "order_draft",
    title: panels.length === 1 ? `Orden: ${panels[0]!.label}` : "Borrador de orden de estudios",
    body,
  };
}

/** PAMI / obra social coverage note for Rx and orders. */
export function buildCoverageNoteItem(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const provider = ctx.insurance?.trim();
  const plan = ctx.insurancePlan?.trim();
  if (!provider && !plan) return null;

  const lines: string[] = [];
  if (provider) lines.push(`Cobertura registrada: ${provider}`);
  if (plan) lines.push(`Plan / afiliado: ${plan}`);

  if (isPamiCoverage(ctx)) {
    lines.push(
      "PAMI: verificar vademécum y autorización según prestación (receta u orden en módulo PAMI si corresponde)."
    );
  } else if (isObraSocialCoverage(ctx)) {
    lines.push(
      "Obra social / prepaga: confirmar cobertura del fármaco o estudio y copago antes de entregar al paciente."
    );
  } else {
    lines.push("Particular o cobertura no clasificada: informar costos al paciente.");
  }

  return {
    id: stableId("coverage_note", lines.join("|")),
    kind: "coverage_note",
    title: "Cobertura del paciente",
    body: lines.join("\n"),
  };
}

/** Dosage support hints for meds in Rx form or habitual treatment. */
export function buildDosageHintItems(ctx: PhysicianAssistContext): PhysicianAssistItem[] {
  const names = [
    ...(ctx.proposedMedications ?? []),
    ...(ctx.regularMedication ?? "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  const blob = names.join(" ").toLowerCase();
  if (!blob.trim()) return [];

  const hints = new Set<string>();
  for (const rule of DOSAGE_HINT_RULES) {
    if (rule.terms.some((t) => blob.includes(t))) {
      hints.add(rule.hint);
    }
  }

  return [...hints].map((hint) => ({
    id: stableId("dosage_hint", hint),
    kind: "dosage_hint" as const,
    title: "Dosis de referencia",
    body: `${hint}\n\nSolo apoyo — ajustar según paciente, función renal/hepática e interacciones.`,
  }));
}

/** Follow-up reminders tied to matched clinical panels. */
export function buildFollowUpReminderItems(ctx: PhysicianAssistContext): PhysicianAssistItem[] {
  const blob = textBlob(ctx);
  const panels = matchedOrderPanels(blob);
  const reminders = new Set<string>();

  for (const panel of panels) {
    if (panel.followUp) reminders.add(panel.followUp);
  }

  if (containsAny(blob, ["diabetes", "dm2", "glicemia"])) {
    reminders.add("Diabetes: recordar pie diabético y vacuna antigripal anual.");
  }
  if (containsAny(blob, ["warfarina", "acenocumarol", "anticoagul"])) {
    reminders.add("Anticoagulado: verificar INR según protocolo y evitar AINE sin indicación.");
  }

  return [...reminders].slice(0, 4).map((line) => ({
    id: stableId("follow_up_reminder", line),
    kind: "follow_up_reminder" as const,
    title: "Control sugerido",
    body: line,
  }));
}

/** Phase C — Rx and order assist items. */
export function buildMedicationOrderAssistItems(
  ctx: PhysicianAssistContext,
  kinds: PhysicianAssistKind[]
): PhysicianAssistItem[] {
  const kindSet = new Set(kinds);
  const items: PhysicianAssistItem[] = [];

  if (kindSet.has("coverage_note")) {
    const coverage = buildCoverageNoteItem(ctx);
    if (coverage) items.push(coverage);
  }
  if (kindSet.has("dosage_hint")) {
    items.push(...buildDosageHintItems(ctx));
  }
  if (kindSet.has("follow_up_reminder")) {
    items.push(...buildFollowUpReminderItems(ctx));
  }

  return items;
}

/** Labels for matched order panels (UI preview). */
export function getMatchedOrderPanelLabels(ctx: PhysicianAssistContext): string[] {
  return matchedOrderPanels(textBlob(ctx)).map((p) => p.label);
}
