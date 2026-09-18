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
    id: "fibrilacion_auricular",
    label: "fibrilación auricular",
    needles: [
      "fibrilacion auricular",
      "fibrilacion atrial",
      "flutter auricular",
      "i48",
      " fa ",
      "fa,",
      "fa.",
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
  {
    id: "apnea_sueno",
    label: "apnea del sueño",
    needles: [
      "apnea",
      "apneas del sueno",
      "saos",
      "sahos",
      "osa",
      "polisomnograf",
      "cpap",
      "bipap",
    ],
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
    aliases: ["presto", "estudio presto", "azd6793", "epoc astrazeneca"],
    sponsor: "AstraZeneca — Fundación Respirar (Dr. Alexis Doreski)",
    molecule: "AZD6793 (anti IL-1, VO)",
    area: "respiratorio",
    summary:
      "Fase 2b, 30 semanas. EPOC moderado a muy severo con exacerbaciones y triple terapia previa.",
    inclusion: [
      "Mayores de 40 años",
      "≥ 2 exacerbaciones en el último año (pueden documentarse por receta de corticoides y/o ATB)",
      "Espirometría: VEF1/FVC < 0.7; VEF1 entre 25 y 80%",
      "Tratamiento previo triple (LABA + LAMA + ICS), ej. Trelegy",
      "IMC entre 18 y 45 kg/m²",
      "Fumadores actuales o exfumadores de > 10 P/Y",
    ],
    exclusion: [
      "Asma u otra enfermedad pulmonar asociada",
      "Cualquier enfermedad inestable y/o no controlada asociada (ej. IC, HTA, DBT)",
      "Cirugía mayor en las 8 semanas previas al ingreso",
    ],
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
    id: "endura-2",
    label: "ENDURA 2 (222725) — EPOC con eosinofilia (anti IL-33)",
    aliases: [
      "endura 2",
      "endura2",
      "endura",
      "222725",
      "estudio 222725",
      "epoc eosinofilia gsk",
    ],
    sponsor: "GSK — Fundación Respirar (Dr. Doreski)",
    molecule: "Ac monoclonal anti IL-33 SC cada 26 semanas (rama placebo)",
    area: "respiratorio",
    summary:
      "Fase 2, 52 semanas (extensión a 104). EPOC con eosinofilia histórica y exacerbaciones.",
    inclusion: [
      "Edad 40 a 79 años",
      "Eosinofilia histórica > 150 cél/µL (si no la tiene, se evalúa en el periodo de selección)",
      "2 exacerbaciones de EPOC en los 12 meses previos, o 1 exacerbación grave (ej. internación por EPOC)",
      "VEF1 entre 30% y ≤ 80%",
    ],
    exclusion: [
      "Asma bronquial",
      "Fibrosis pulmonar",
      "TBC activa",
      "Enfermedad oncológica activa",
      "Otras enfermedades asociadas inestables y/o no controladas",
    ],
    candidateNeedles: [
      "epoc",
      "eosinofil",
      "exacerbacion",
      "vef1",
      "fev1",
      "internacion por epoc",
    ],
    conditionIds: ["epoc"],
  },
  {
    id: "bronquiectasias",
    label: "Bronquiectasias — GSK3862995B (anti IL-33)",
    aliases: ["bronquiectasias", "gsk3862995", "gsk3862995b", "il-33", "il33"],
    sponsor: "GSK",
    molecule: "GSK3862995B 600 mg / 300 mg / placebo SC cada 12 semanas",
    area: "respiratorio",
    summary:
      "AcM anti IL-33. Bronquiectasia confirmada por TC, 18–85 años, IMC 18–35, con exacerbaciones o QOL-B baja.",
    inclusion: [
      "18–85 años inclusive",
      "IMC 18–35 kg/m²",
      "Diagnóstico de bronquiectasia: clínica coherente (tos, esputo crónico o infecciones recurrentes) confirmada por TC de tórax",
      "En 12 meses previos: ≥ 2 exacerbaciones pulmonares con nueva ATB, o 1 con hospitalización; o 0–1 exacerbación y QOL-B RSS < 50",
      "Productores actuales de esputo (muestra espontánea en selección)",
      "No fumadores o exfumadores (≥ 6 meses sin fumar)",
    ],
    exclusion: [
      "Diagnóstico primario de asma o EPOC",
      "Bronquiectasia por FQ, déficit A1AT, inmunodeficiencia común variable, hipogammaglobulinemia o tracción por enfermedad fibrótica",
      "Oxigenoterapia a largo plazo > 12 h/día",
    ],
    candidateNeedles: [
      "bronquiect",
      "j47",
      "esputo",
      "exacerbacion pulmonar",
      "tc de torax",
      "tomografia de torax",
    ],
    conditionIds: ["bronquiectasias"],
  },
  {
    id: "kt621",
    label: "KT621_AS-202 — Asma moderada/severa con eosinofilia",
    aliases: [
      "kt621",
      "kt621_as-202",
      "kt621 as-202",
      "kymera",
      "asma eosinofilia",
      "asma kymera",
    ],
    sponsor: "KYMERA Therapeutics — Fundación Respirar (Dr. Daniel Fandiño)",
    molecule: "Ac monoclonal anti IL-4 / IL-13 (vía oral)",
    area: "respiratorio",
    summary: "Fase 2b, 16 semanas. Asma moderada a severa con eosinofilia bajo ICS+LABA.",
    inclusion: [
      "18 a 75 años",
      "Diagnóstico de asma ≥ 12 meses previos al ingreso",
      "Tratamiento con dosis medias o altas de corticoides INH asociados a LABA (ej. Seretide 250 o 500); pueden estar en triple terapia (ej. Trelegy)",
      "≥ 1 crisis asmática en el año previo que requirió corticoides orales o inyectables",
    ],
    exclusion: [
      "Enfermedades asociadas inestables y/o no controladas (ej. insuficiencia cardíaca)",
      "Tratamiento activo con biológicos para asma (ej. mepolizumab, omalizumab)",
    ],
    candidateNeedles: [
      "asma",
      "j45",
      "eosinofil",
      "seretide",
      "trelegy",
      "exacerbacion",
      "crisis asmatic",
      "corticoide",
      "laba",
    ],
    conditionIds: ["asma"],
  },
  {
    id: "ydao",
    label: "YDAO (J3R-MC-YDAO) — Apneas del sueño + sobrepeso/obesidad",
    aliases: [
      "ydao",
      "j3r-mc-ydao",
      "j3r mc ydao",
      "eloralintida",
      "eloralintide",
      "apneas del sueno",
      "apnea lilly",
      "estudio ydao",
    ],
    sponsor: "Lilly — Fundación Respirar (Dr. Alexis Doreski)",
    molecule: "Eloralintida SC semanal (rama placebo)",
    area: "respiratorio",
    summary: "Fase 3, 64 semanas. Apneas del sueño asociadas a sobrepeso u obesidad.",
    inclusion: [
      "Mayores de 18 años",
      "IMC ≥ 27 kg/m²",
      "Antecedentes clínicos de apneas del sueño (si hay polisomnografía previa, acompañar el estudio)",
    ],
    exclusion: [
      "Cirugía bariátrica previa o planificada",
      "Balón gástrico previo o planificado",
      "Diabetes tipo 1 o tipo 2",
      "Toda enfermedad asociada inestable y/o no controlada",
    ],
    candidateNeedles: [
      "apnea",
      "saos",
      "sahos",
      "polisomnograf",
      "cpap",
      "obesidad",
      "sobrepeso",
      "imc",
    ],
    conditionIds: ["apnea_sueno", "obesidad"],
  },
  {
    id: "bax-duo",
    label: "BAX-DÚO — Baxdrostat ± dapagliflozina (HTA + ERC)",
    aliases: ["bax-duo", "baxduo", "baxdrostat", "bax duo", "baxdúo"],
    sponsor: "Fundación Respirar",
    molecule: "Baxdrostat ± Dapagliflozina (1 comprimido/día VO; duración ~3.5–5 años)",
    area: "renal",
    summary:
      "HTA + ERC con proteinuria. Randomización Baxdrostat+dapagliflozina vs placebo+dapagliflozina. Seguimiento CV y renal.",
    inclusion: [
      "Ambos sexos, ≥ 18 años",
      "HTA con TAS > 130 mmHg",
      "Grupo 1 ERC: eGFR 30–60 ml/min y UACR 30–500 mg/g",
      "Grupo 2 ERC: eGFR 30–75 ml/min y UACR > 500 mg/g",
      "Pueden tener o no dapagliflozina previa",
    ],
    exclusion: [
      "HTA > 180 mmHg en la selección",
      "DM2 no controlada (HbA1c > 10.5%)",
      "IC CF IV",
      "Cirugía cardíaca < 3 meses",
      "ACV",
      "Falla hepática",
      "Insuficiencia suprarrenal",
      "HiperK / HipoNa",
      "Trasplante renal o diálisis",
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
    label: "EKGB / Muvalaplin — Riesgo de primer evento ASCVD (Lp(a))",
    aliases: [
      "ekgb",
      "muvalaplin",
      "lp(a)",
      "lpa",
      "dislipidemia lilly",
      "protocolo ekgb",
      "riesgo de primer evento ascvd",
      "primer evento ascvd",
      "prevencion primaria ascvd",
      "prevención primaria ascvd",
    ],
    sponsor: "Eli Lilly",
    molecule:
      "Muvalaplin (VO diaria) — molécula pequeña que reduce la producción hepática de apo(a) y los niveles de Lp(a)",
    area: "lipidico",
    summary:
      "Prevención primaria: sin ASCVD previo + Lp(a) elevada + ≥ 4 factores de riesgo (u otros criterios que califican). También cohorte secundaria IAM/ACV/EAP. Objetivo: reducir riesgo residual de IAM, ACV y EAP.",
    inclusion: [
      "Sin ASCVD previo (confirmar ausencia de eventos)",
      "Riesgo de primer evento ASCVD: ≥ 4 de los siguientes factores — (1) edad avanzada: F ≥ 70 / M ≥ 65; (2) tabaquismo actual (cigarrillos, puros o pipa de forma regular); (3) AF de ASCVD prematura: padre/hermano con MI/CABG/PCI < 55 o madre/hermana < 60; (4) HTA en tratamiento al momento de la selección; (5) diabetes en tratamiento al momento de la selección; (6) ↓ función renal: UACR > 100 y < 5000 mg/g, o eGFR ≥ 30 y < 60 ml/min/1.73 m²",
      "Otros criterios que también califican: hiperlipidemia LDL ≥ 100 mg/dl en tto hipolipemiante máximo tolerado; Lp(a) ≥ 350 nmol/l (preselección o selección); PCRus > 2 mg/l",
      "Lp(a) ≥ 175 nmol/l típica para screening (muy elevada ≥ 350 califica de por sí)",
      "Datos mínimos para derivación: edad y sexo al nacer; antecedentes CV (sin ASCVD); factores de riesgo; diabetes sí/no + tto; HTA sí/no + tto; eGFR/UACR/LDL/Lp(a)/PCRus; CAC si disponible; contacto del paciente",
      "Cohorte prevención secundaria (si aplica): antecedentes de IAM, ACV o enfermedad arterial de miembros inferiores",
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
      "prediabetes",
      "tabaquism",
      "fumador",
      "egfr",
      "uacr",
      "pcrus",
      "hs crp",
      "cac",
      "calcio coronario",
      "iam",
      "acv",
      "eap",
    ],
    conditionIds: ["dislipidemia", "hta", "diabetes", "erc", "tabaquismo", "ascvd"],
  },
  {
    id: "attain-now",
    label: "ATTAIN-NOW — Sobrepeso (IMC 25–29,9) + pre-factores metabólicos",
    aliases: [
      "attain-now",
      "attain now",
      "estudio attain-now",
      "estudio clinico attain-now",
      "attainnow",
    ],
    sponsor: "Eli Lilly",
    molecule: "Tratamiento oral diario (fase 3) + acompañamiento en hábitos saludables",
    area: "cardiometabolico",
    summary:
      "Fase 3. Intervenir temprano en sobrepeso (no obesidad) con ≥ 1 pre-factor (prediabetes, PA limítrofe o lípidos limítrofes) para prevenir progresión a obesidad y complicaciones metabólicas.",
    inclusion: [
      "≥ 18 años",
      "IMC entre 25 y 29,9 kg/m²",
      "Relación cintura/altura ≥ 0,50",
      "≥ 1 factor de riesgo: prediabetes; prehipertensión / PA limítrofe; predislipidemia / perfil lipídico limítrofe",
      "Valores orientativos prediabetes (uno o más): HbA1c 5,7–6,4%; glucemia en ayunas 100–125 mg/dL; glucemia 2 h PTOG 140–199 mg/dL",
      "Valores orientativos PA limítrofe: PAS 120–139 y/o PAD 80–89 mmHg",
      "Valores orientativos lípidos limítrofes (uno o más): colesterol total 200–239; LDL-C 130–159; triglicéridos 150–199 mg/dL",
      "Para evaluar derivación enviar: edad, peso, altura, cintura, antecedentes, medicación, últimos análisis",
    ],
    exclusion: [
      "Obesidad establecida (IMC ≥ 30)",
      "Diabetes establecida",
      "Hipertensión establecida",
      "Dislipidemia establecida",
    ],
    candidateNeedles: [
      "sobrepeso",
      "imc",
      "prediabetes",
      "prehipertens",
      "predislipid",
      "hba1c",
      "glucemia",
      "cintura",
      "ldl",
      "triglicer",
      "colesterol",
    ],
    conditionIds: ["obesidad", "dislipidemia"],
  },
  {
    id: "gzpw",
    label: "GZPW — Sobrepeso + enfermedad CV/renal (Orforgliprón)",
    aliases: [
      "gzpw",
      "eli lilly gzpw",
      "attain-outcomes",
      "attain outcomes",
      "orforglipron",
      "sobrepeso cv",
      "sobrepeso renal",
    ],
    sponsor: "Eli Lilly",
    molecule: "Orforgliprón",
    area: "cardiometabolico",
    summary:
      "Edad ≥ 50, IMC ≥ 25, con ≥ 1 criterio CV o enfermedad renal. Prioriza diabéticos. Con o sin diabetes.",
    inclusion: [
      "Edad ≥ 50 años",
      "IMC ≥ 25 (sobrepeso o más)",
      "≥ 1 criterio cardiovascular: IAM; ACV; revascularización coronaria (bypass/angioplastia), carotídea o vascular periférica; enfermedad carotídea residual (estenosis ≥ 50%); EAP residual (estenosis ≥ 50%)",
      "O enfermedad renal: eGFR < 60 ml/min y/o proteinuria (≥ 2 determinaciones separadas ≥ 3 meses)",
      "Con o sin diabetes (se priorizan diabéticos)",
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
      "carotide",
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
      "antihipertensivos y diuretico",
      "2 antihipertensivos",
      "dos antihipertensivos",
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
    conditionIds: ["hta", "ascvd", "erc", "diabetes", "obesidad", "fibrilacion_auricular", "tabaquismo"],
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
      "En tratamiento estándar",
      "Y además: cardiopatía estructural o internación por IC descompensada en 12 meses",
    ],
    exclusion: [
      "Miocardiopatías específicas: hipertrófica, infiltrativa, arritmogénica; valvulopatías graves; congénitas significativas; miocarditis/pericarditis activa",
      "FEVI ≤ 40%",
      "Internación por IC descompensada en los últimos 30 días",
      "Diabetes tipo 1",
      "DM2 con HbA1c > 10%, descontrol agudo o antecedente de cetoacidosis / estado hiperosmolar",
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
    aliases: [
      "hf-polaris",
      "hf polaris",
      "polaris",
      "zenagamtide",
      "nn9490",
      "nn9490-8266",
      "nct07567001",
    ],
    sponsor: "Novo Nordisk",
    molecule: "Zenagamtide (agonista GLP-1 / amilina / calcitonina; SC semanal)",
    area: "cardiometabolico",
    summary:
      "Fase 3b global (NCT07567001). Obesidad + HFpEF/HFmrEF. Evalúa reducción de eventos CV, hospitalizaciones y mortalidad.",
    inclusion: [
      "≥ 18 años",
      "IMC ≥ 30 o ≥ 27 con comorbilidades",
      "Diagnóstico estable de HFpEF (FE ≥ 50%) o HFmrEF (FE 41–49%)",
      "En tratamiento estándar óptimo estable",
      "Interesado en participar en investigación clínica y cumplir visitas",
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
