/** Medical terms and clinical-trial protocols used by Gemini clinic search in NexClinic. */

export type GeminiLexiconCondition = {
  id: string;
  label: string;
  /** Folded (unaccented, lowercase) needles matched against HC free text. */
  needles: string[];
};

export type GeminiClinicalProtocol = {
  id: string;
  label: string;
  aliases: string[];
  sponsor?: string;
  molecule?: string;
  area: "respiratorio" | "cardiometabolico" | "renal" | "lipidico";
  summary: string;
  inclusion: string[];
  exclusion: string[];
  /** Needles used to find candidate patients inside NexClinic HC text. */
  candidateNeedles: string[];
  /** Related lexicon condition ids. */
  conditionIds: string[];
};

export const GEMINI_LEXICON_CONDITIONS: GeminiLexiconCondition[] = [
  {
    id: "hta",
    label: "hipertensión",
    needles: [
      "hipertens",
      " hta",
      "hta ",
      "hta,",
      "hta.",
      "i10",
      "i11",
      "i12",
      "i13",
      "i15",
      "presion alta",
      "tas >",
      "tas>",
    ],
  },
  {
    id: "diabetes",
    label: "diabetes",
    needles: [
      "diabetes",
      "dbt",
      "dm2",
      "dm1",
      "dm tipo",
      "e10",
      "e11",
      "e14",
      "glucem",
      "hba1c",
      "cetoacidosis",
      "hiperosmolar",
    ],
  },
  {
    id: "asma",
    label: "asma",
    needles: ["asma", "j45", "exacerbacion asmatic", "corticoide inh", "laba"],
  },
  {
    id: "epoc",
    label: "EPOC",
    needles: [
      "epoc",
      "enfermedad pulmonar obstructiva",
      "j44",
      "vef1",
      "fev1",
      "fvc",
      "exacerbacion pulmonar",
      "trelegy",
      "laba + lama",
      "eosinofil",
    ],
  },
  {
    id: "bronquiectasias",
    label: "bronquiectasias",
    needles: ["bronquiect", "j47", "esputo cronico", "infecciones respiratorias recurrentes"],
  },
  {
    id: "obesidad",
    label: "obesidad",
    needles: ["obesidad", "sobrepeso", "e66", "imc", "bmi", "indice de masa"],
  },
  {
    id: "dislipidemia",
    label: "dislipidemia",
    needles: [
      "dislipid",
      "colesterol",
      "hiperlipid",
      "ldl",
      "e78",
      "lp(a)",
      "lpa",
      "lipoproteina(a)",
      "lipoproteina a",
      "pcrus",
      "hs crp",
      "hscrp",
    ],
  },
  {
    id: "erc",
    label: "enfermedad renal crónica",
    needles: [
      "enfermedad renal",
      "insuficiencia renal",
      "erc",
      "irc",
      "egfr",
      "tfg",
      "proteinuria",
      "uacr",
      "albuminuria",
      "n18",
    ],
  },
  {
    id: "ic",
    label: "insuficiencia cardíaca",
    needles: [
      "insuficiencia cardiaca",
      " ic ",
      "ic,",
      "ic.",
      "hfpef",
      "hfmref",
      "fevi",
      "fey",
      "fraccion de eyeccion",
      "nyha",
      "nt-probnp",
      "ntprobnp",
      "i50",
      "descompensada",
    ],
  },
  {
    id: "ascvd",
    label: "enfermedad cardiovascular aterosclerótica",
    needles: [
      "ascvd",
      "ateroscler",
      "cardiovascular",
      "iam",
      "infarto",
      "acv",
      "stroke",
      "ictus",
      "revasculariz",
      "angioplastia",
      "bypass",
      "stent",
      "crm",
      "cabg",
      "pci",
      "enfermedad arterial periferica",
      "eap",
      "claudicacion",
      "carotidea",
      "estenosis",
      "mmii",
    ],
  },
  {
    id: "tabaquismo",
    label: "tabaquismo",
    needles: ["tabaquism", "fumador", "exfumador", "ex fumador", "paquetes/ano", "p/y", "pack year"],
  },
  {
    id: "hipotiroidismo",
    label: "hipotiroidismo",
    needles: ["hipotiroid", "e03"],
  },
  {
    id: "ansiedad",
    label: "ansiedad",
    needles: ["ansiedad", "f41"],
  },
  {
    id: "depresion",
    label: "depresión",
    needles: ["depresi", "f32", "f33"],
  },
];

export const GEMINI_CLINICAL_PROTOCOLS: GeminiClinicalProtocol[] = [
  {
    id: "gzmr",
    label: "GZMR — Asma moderada/severa no controlada + sobrepeso/obesidad",
    aliases: ["gzmr", "brenipatide", "asma lilly", "j2s-mc-gzmr"],
    sponsor: "Eli Lilly",
    molecule: "Brenipatide (SC)",
    area: "respiratorio",
    summary:
      "Fase 2, 52 semanas. Asma moderada a severa no controlada con IMC ≥ 22. Brenipatide SC vs placebo.",
    inclusion: [
      "18–75 años",
      "IMC ≥ 22",
      "Asma ≥ 12 meses",
      "Reversibilidad espirométrica",
      "ICS medio/alto + LABA (ej. Seretide 250/500); puede Montelukast",
      "≥ 1 exacerbación en 12 meses",
    ],
    exclusion: ["DM1 u otra diabetes inestable", "Salud mental inestable", "Enfermedad asociada no controlada", "TBC activa"],
    candidateNeedles: ["asma", "j45", "exacerbacion", "seretide", "montelukast", "obesidad", "sobrepeso", "imc"],
    conditionIds: ["asma", "obesidad"],
  },
  {
    id: "presto",
    label: "PRESTO — EPOC moderado a muy severo",
    aliases: ["presto", "azd6793", "epoc astrazeneca"],
    sponsor: "AstraZeneca",
    molecule: "AZD6793 (anti IL-1, VO)",
    area: "respiratorio",
    summary: "Fase 2b, 30 semanas. EPOC moderado–muy severo con exacerbaciones y triple terapia.",
    inclusion: [
      "> 40 años",
      "≥ 2 exacerbaciones en el último año",
      "VEF1/FVC < 0.7 y VEF1 25–80%",
      "Triple terapia LABA+LAMA+ICS (ej. Trelegy)",
      "IMC 18–45",
      "Fumador o exfumador > 10 P/Y",
    ],
    exclusion: ["Asma u otra enfermedad pulmonar asociada", "Enfermedad inestable (IC, HTA, DBT)", "Cirugía mayor < 8 semanas"],
    candidateNeedles: ["epoc", "j44", "vef1", "fev1", "trelegy", "exacerbacion", "fumador", "exfumador"],
    conditionIds: ["epoc", "tabaquismo"],
  },
  {
    id: "theseus",
    label: "THESEUS — EPOC eosinofílico mal controlado",
    aliases: ["theseus", "lunsekimig"],
    molecule: "Lunsekimig (SC mensual)",
    area: "respiratorio",
    summary: "EPOC obstructivo con fenotipo eosinofílico y exacerbaciones.",
    inclusion: [
      "40–80 años",
      "Fumador/ex ≥ 10 P/Y",
      "FEV1/FVC < 0.70",
      "Doble o triple terapia estable 12 semanas",
      "2 exacerbaciones moderadas o 1 severa",
      "Eosinófilos ≥ 150/µL",
    ],
    exclusion: [],
    candidateNeedles: ["epoc", "eosinofil", "exacerbacion", "fumador", "exfumador", "vef1", "fev1"],
    conditionIds: ["epoc", "tabaquismo"],
  },
  {
    id: "bronquiectasias",
    label: "Bronquiectasias — GSK3862995B (anti IL-33)",
    aliases: ["bronquiectasias", "gsk3862995", "il-33", "il33"],
    sponsor: "GSK",
    molecule: "GSK3862995B (SC cada 12 semanas)",
    area: "respiratorio",
    summary: "Bronquiectasia confirmada por TC, 18–85 años, IMC 18–35, con exacerbaciones o QOL-B baja.",
    inclusion: [
      "18–85 años",
      "IMC 18–35",
      "Bronquiectasia clínica + TC de tórax",
      "≥ 2 exacerbaciones con ATB o 1 con internación en 12 meses, o QOL-B RSS < 50",
      "Productor de esputo",
      "No fumador o exfumador ≥ 6 meses",
    ],
    exclusion: [
      "Diagnóstico primario de asma o EPOC",
      "FQ, déficit A1AT, inmunodeficiencia, bronquiectasia por tracción",
      "O2 > 12 h/día",
    ],
    candidateNeedles: ["bronquiect", "j47", "esputo", "exacerbacion pulmonar", "tc de torax", "tomografia de torax"],
    conditionIds: ["bronquiectasias"],
  },
  {
    id: "bax-duo",
    label: "BAX-DÚO — Baxdrostat ± dapagliflozina (HTA + ERC)",
    aliases: ["bax-duo", "baxduo", "baxdrostat", "bax duo"],
    molecule: "Baxdrostat ± Dapagliflozina",
    area: "renal",
    summary: "HTA con ERC (eGFR/UACR). Seguimiento CV y renal a largo plazo.",
    inclusion: [
      "≥ 18 años",
      "HTA TAS > 130 mmHg",
      "ERC: eGFR 30–60 con UACR 30–500, o eGFR 30–75 con UACR > 500",
    ],
    exclusion: [
      "DM2 no controlada HbA1c > 10.5%",
      "IC CF IV",
      "ACV reciente / cirugía cardíaca < 3 meses",
      "Falla hepática, insuficiencia suprarrenal",
      "HiperK / HipoNa",
      "Trasplante renal o diálisis",
      "HTA > 180 en selección",
    ],
    candidateNeedles: [
      "hipertens",
      " hta",
      "enfermedad renal",
      "erc",
      "irc",
      "egfr",
      "uacr",
      "proteinuria",
      "dapagliflozina",
    ],
    conditionIds: ["hta", "erc"],
  },
  {
    id: "ekgb",
    label: "EKGB / Muvalaplin — Lp(a) elevada (prevención primaria)",
    aliases: ["ekgb", "muvalaplin", "lp(a)", "lpa", "dislipidemia lilly"],
    sponsor: "Eli Lilly",
    molecule: "Muvalaplin (VO diaria)",
    area: "lipidico",
    summary: "Prevención primaria sin ASCVD previo, Lp(a) ≥ 175 nmol/l y ≥ 4 factores de riesgo.",
    inclusion: [
      "≥ 18 años",
      "Sin ASCVD previo",
      "Lp(a) ≥ 175 nmol/l (muy elevada ≥ 350 también califica)",
      "≥ 4 de: edad avanzada, tabaquismo, AF ASCVD prematura, HTA en tto, diabetes en tto, ↓ función renal",
      "Otros: LDL ≥ 100 en tto máximo, PCRus > 2",
    ],
    exclusion: [],
    candidateNeedles: [
      "lp(a)",
      "lpa",
      "lipoproteina",
      "dislipid",
      "hiperlipid",
      "ldl",
      "hipertens",
      "diabetes",
      "tabaquism",
      "fumador",
      "egfr",
      "uacr",
      "pcrus",
    ],
    conditionIds: ["dislipidemia", "hta", "diabetes", "erc", "tabaquismo"],
  },
  {
    id: "gzpw",
    label: "GZPW / ATTAIN-OUTCOMES — Sobrepeso + CV/renal",
    aliases: ["gzpw", "attain", "attain-outcomes", "orforglipron", "sobrepeso cv"],
    sponsor: "Eli Lilly",
    molecule: "Orforgliprón (VO diaria)",
    area: "cardiometabolico",
    summary: "≥ 50 años, IMC ≥ 25, con evento CV/revascularización o enfermedad renal. Prioriza diabéticos.",
    inclusion: [
      "≥ 50 años",
      "IMC ≥ 25",
      "≥ 1 de: IAM, ACV, revascularización (coronaria/carotídea/periférica), EAP residual, o ERC (eGFR < 60 y/o proteinuria)",
      "Con o sin diabetes (prioridad diabéticos)",
    ],
    exclusion: [],
    candidateNeedles: [
      "iam",
      "infarto",
      "acv",
      "revasculariz",
      "angioplastia",
      "bypass",
      "stent",
      "eap",
      "claudicacion",
      "enfermedad renal",
      "egfr",
      "proteinuria",
      "obesidad",
      "sobrepeso",
      "diabetes",
    ],
    conditionIds: ["ascvd", "obesidad", "erc", "diabetes"],
  },
  {
    id: "maritime-cv",
    label: "MARITIME-CV — ASCVD + sobrepeso/obesidad",
    aliases: ["maritime-cv", "maritime cv", "cagrisema cv", "amgen maritime"],
    sponsor: "Amgen",
    molecule: "CagriSema (SC mensual/semanal)",
    area: "cardiometabolico",
    summary: "≥ 45 años, IMC ≥ 27, ASCVD (IAM/ACV isquémico/EAP), tto optimizado; ≥ 60 días post evento.",
    inclusion: [
      "≥ 45 años",
      "IMC ≥ 27",
      "ASCVD: IAM, ACV isquémico o EAP",
      "Tratamiento médico optimizado",
      "≥ 60 días desde último evento isquémico",
    ],
    exclusion: ["Evento CV < 60 días", "IC avanzada NYHA IV", "DM1", "DM2 HbA1c > 10% / cetoacidosis / hiperosmolar"],
    candidateNeedles: [
      "iam",
      "infarto",
      "acv",
      "isquemico",
      "eap",
      "arterial periferica",
      "obesidad",
      "sobrepeso",
      "ascvd",
      "imc",
    ],
    conditionIds: ["ascvd", "obesidad"],
  },
  {
    id: "zenith",
    label: "ZENITH — HTA no controlada (NCT07181109)",
    aliases: [
      "zenith",
      "estudio zenith",
      "protocolo zenith",
      "nct07181109",
      "hta no controlada",
      "hipertension no controlada",
    ],
    area: "cardiometabolico",
    summary:
      "HTA ≥ 140/90 pese a ≥ 2 antihipertensivos (incluye diurético) + ECV establecida (≥ 18) o alto riesgo CV (≥ 55).",
    inclusion: [
      "HTA no controlada: PA ≥ 140/90 mmHg pese a tratamiento estable con ≥ 2 antihipertensivos, incluyendo un diurético",
      "Situación 1 — ECV establecida (≥ 18 años) con ≥ 1 de: IAM o revascularización coronaria; ACV/AIT; enfermedad arterial periférica",
      "Situación 2 — Alto riesgo CV (≥ 55 años) con ≥ 2 de: edad ≥ 70; eGFR < 60; UACR > 300 mg/g; tabaquismo activo; FA en tratamiento; CAC > 100 Agatston; NT-proBNP > 125 pg/mL; DM1/DM2 y/o obesidad (IMC ≥ 30)",
    ],
    exclusion: [
      "Hipertensión secundaria conocida",
      "eGFR < 30 mL/min/1.73 m²",
      "Hipotensión ortostática sintomática",
      "Potasio > 4.8 mEq/L",
      "AST/ALT > 3× LSN",
      "Bilirrubina total > 1.5× LSN",
      "INR > 1.5",
      "ECV no estable: IAM, ACV o arritmia significativa < 6 meses",
      "Cáncer activo o tratamiento oncológico < 5 años (excepto cáncer de piel no melanoma curado)",
      "Embarazo, lactancia o intención de embarazo durante el estudio",
    ],
    candidateNeedles: [
      "hipertens",
      "hta",
      "140/90",
      "antihipertens",
      "diuretico",
      "diurético",
      "infarto",
      "iam",
      "revasculariz",
      "acv",
      "ait",
      "arterial periferica",
      "egfr",
      "uacr",
      "tabaquismo",
      "fibrilacion auricular",
      "nt-probnp",
      "obesidad",
      "imc",
      "diabetes",
    ],
    conditionIds: ["hta", "ascvd", "erc", "diabetes", "obesidad"],
  },
  {
    id: "maritime-hf",
    label: "MARITIME-HF — IC + obesidad",
    aliases: ["maritime-hf", "maritime hf", "cagrisema hf", "ic obesidad"],
    molecule: "CagriSema (SC semanal)",
    area: "cardiometabolico",
    summary: "≥ 18 años, IMC ≥ 30, IC NYHA II–IV, FEVI > 40%, NT-proBNP elevado o internación IC < 12 meses.",
    inclusion: [
      "≥ 18 años",
      "IMC ≥ 30",
      "IC NYHA II–IV ≥ 30 días",
      "FEVI > 40%",
      "NT-proBNP elevado",
      "Cardiopatía estructural o internación por IC descompensada < 12 meses",
      "Tratamiento estándar",
    ],
    exclusion: [
      "Miocardiopatías hipertrófica/infiltrativa/arritmogénica",
      "Valvulopatía grave / congénita significativa",
      "Miocarditis/pericarditis activa",
      "FEVI ≤ 40%",
      "Internación IC < 30 días",
      "DM1 o DM2 descontrolada",
    ],
    candidateNeedles: [
      "insuficiencia cardiaca",
      "hfpef",
      "hfmref",
      "fevi",
      "nyha",
      "nt-probnp",
      "obesidad",
      "imc",
      "descompensada",
    ],
    conditionIds: ["ic", "obesidad"],
  },
  {
    id: "hf-polaris",
    label: "HF-POLARIS — Obesidad + HFpEF/HFmrEF (Zenagamtide)",
    aliases: ["hf-polaris", "hf polaris", "polaris", "zenagamtide", "nn9490"],
    sponsor: "Novo Nordisk",
    molecule: "Zenagamtide (SC semanal)",
    area: "cardiometabolico",
    summary: "Fase 3b. Obesidad (IMC ≥ 30 o ≥ 27 con comorbilidades) + HFpEF/HFmrEF estable.",
    inclusion: [
      "≥ 18 años",
      "IMC ≥ 30 o ≥ 27 con comorbilidades",
      "HFpEF (FE ≥ 50%) o HFmrEF (FE 41–49%) estable",
      "Tratamiento estándar óptimo estable",
      "Interés en investigación clínica",
    ],
    exclusion: [],
    candidateNeedles: [
      "hfpef",
      "hfmref",
      "insuficiencia cardiaca",
      "fraccion de eyeccion",
      "fevi",
      "obesidad",
      "imc",
      "sobrepeso",
    ],
    conditionIds: ["ic", "obesidad"],
  },
  {
    id: "azure",
    label: "AZURE — Riesgo residual lipídico post-evento / alto riesgo",
    aliases: ["azure", "estudio azure"],
    area: "lipidico",
    summary: "Prevención secundaria reciente o alto riesgo con LDL residual.",
    inclusion: [
      "Grupo A: IAM/ACV/isquemia MMII 1–12 meses + LDL > 75 + 1 factor extra",
      "Grupo B: H ≥ 50 / M ≥ 55, LDL > 100 + revascularización o DM2 con daño de órgano",
    ],
    exclusion: [],
    candidateNeedles: ["iam", "acv", "infarto", "ldl", "revasculariz", "diabetes", "irc", "erc", "hs crp", "lp(a)"],
    conditionIds: ["ascvd", "dislipidemia", "diabetes", "erc"],
  },
];

export function foldMedicalText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function findProtocolByMessage(folded: string): GeminiClinicalProtocol | null {
  let best: GeminiClinicalProtocol | null = null;
  let bestLen = 0;
  for (const protocol of GEMINI_CLINICAL_PROTOCOLS) {
    for (const alias of protocol.aliases) {
      const needle = foldMedicalText(alias);
      if (needle.length >= 3 && folded.includes(needle) && needle.length > bestLen) {
        best = protocol;
        bestLen = needle.length;
      }
    }
  }
  return best;
}

export function formatProtocolCatalogForPrompt(protocol?: GeminiClinicalProtocol | null): string {
  const list = protocol ? [protocol] : GEMINI_CLINICAL_PROTOCOLS;
  return list
    .map((p) => {
      const lines = [
        `Protocolo: ${p.label}`,
        p.sponsor ? `Sponsor: ${p.sponsor}` : null,
        p.molecule ? `Molécula: ${p.molecule}` : null,
        `Resumen: ${p.summary}`,
        `Inclusión: ${p.inclusion.join("; ")}`,
        p.exclusion.length ? `Exclusión: ${p.exclusion.join("; ")}` : null,
        `Términos de búsqueda en HC: ${p.candidateNeedles.join(", ")}`,
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");
}

/** Texto listo para insertar en evolución desde Consultas. */
export function formatProtocolNoteForEvolution(protocol: GeminiClinicalProtocol): string {
  const lines = [
    `Protocolo ${protocol.label}`,
    protocol.summary,
    "",
    "Inclusión:",
    ...protocol.inclusion.map((item) => `• ${item}`),
  ];
  if (protocol.exclusion.length > 0) {
    lines.push("", "Exclusión principal:");
    lines.push(...protocol.exclusion.map((item) => `• ${item}`));
  }
  lines.push(
    "",
    "Nota: la elegibilidad final la determina el equipo del estudio según protocolo completo."
  );
  return lines.join("\n");
}

export function formatLexiconTermsForPrompt(): string {
  return GEMINI_LEXICON_CONDITIONS.map((c) => `${c.label} (${c.needles.slice(0, 6).join(", ")})`).join(
    "; "
  );
}
