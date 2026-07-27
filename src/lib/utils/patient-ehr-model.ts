export type PatientEhrConsultation = {
  id: string;
  created_at: string;
  professional_name: string;
  chief_complaint: string;
  diagnosis: string;
  evolution: string;
  indications: string;
  category: "evolution" | "diagnostic" | "treatment" | "vitals" | "document";
};

export type PatientEhrAttachment = {
  id: string;
  file_name: string;
  created_at: string;
  category: string | null;
};

export type PatientEhrPrescription = {
  id: string;
  created_at: string;
  label: string;
};

export type PatientEhrDiagnosisRow = {
  id: string;
  dateLabel: string;
  name: string;
  chronic: boolean;
  recordId: string;
};

export type PatientEhrTreatmentRow = {
  id: string;
  dateLabel: string;
  product: string;
  dose: string;
  frequency: string;
  notes: string;
  status: string;
  recordId: string;
};

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}-${months[d.getMonth()]}-${yy}`;
}

function classifyCategory(chief_complaint: string): PatientEhrConsultation["category"] {
  const cc = chief_complaint.toLowerCase();
  if (cc.includes("signos vitales")) return "vitals";
  if (cc.includes("tratamiento")) return "treatment";
  if (cc.includes("diagnóstico") || cc.includes("diagnostico")) return "diagnostic";
  if (cc.includes("documento adjunto") || cc.includes("archivo")) return "document";
  return "evolution";
}

function stripHceMarker(text: string): string {
  return text.replace(/^\[HCE:[^\]]+\]\s*/i, "").replace(/^\[Import:[^\]]+\]\s*/i, "").trim();
}

function parseTreatmentLines(indications: string, recordId: string, dateLabel: string): PatientEhrTreatmentRow[] {
  const raw = indications.trim();
  if (!raw) return [];

  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  return lines.map((line, i) => {
    const parts = line.split(/\s*[·|–-]\s*/);
    const product = parts[0]?.slice(0, 80) || line.slice(0, 80);
    return {
      id: `${recordId}-t-${i}`,
      dateLabel,
      product,
      dose: parts[1]?.slice(0, 40) ?? "—",
      frequency: parts[2]?.slice(0, 40) ?? "—",
      notes: line,
      status: "Actual",
      recordId,
    };
  });
}

export function buildEhrPayloadFromRecords(
  records: Array<{
    id: string;
    created_at: string;
    chief_complaint: string | null;
    diagnosis: string | null;
    evolution: string | null;
    indications: string | null;
    professional_name: string;
  }>
): {
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
} {
  const consultations: PatientEhrConsultation[] = [];
  const diagnosisRows: PatientEhrDiagnosisRow[] = [];
  const treatmentRows: PatientEhrTreatmentRow[] = [];
  const seenDiagnosis = new Set<string>();

  for (const r of records) {
    const chief = stripHceMarker(r.chief_complaint ?? "");
    const category = classifyCategory(chief);
    const dateLabel = formatShortDate(r.created_at);

    consultations.push({
      id: r.id,
      created_at: r.created_at,
      professional_name: r.professional_name,
      chief_complaint: chief,
      diagnosis: stripHceMarker(r.diagnosis ?? ""),
      evolution: r.evolution ?? "",
      indications: r.indications ?? "",
      category,
    });

    const diagText = stripHceMarker(r.diagnosis ?? "");
    if (diagText && category !== "vitals") {
      const key = diagText.toLowerCase().slice(0, 120);
      if (!seenDiagnosis.has(key)) {
        seenDiagnosis.add(key);
        diagnosisRows.push({
          id: `d-${r.id}`,
          dateLabel,
          name: diagText,
          chronic: category === "diagnostic" || chief.toLowerCase().includes("crónic"),
          recordId: r.id,
        });
      }
    }

    if (r.indications?.trim()) {
      treatmentRows.push(...parseTreatmentLines(r.indications, r.id, dateLabel));
    } else if (category === "treatment" && diagText) {
      treatmentRows.push({
        id: `t-${r.id}`,
        dateLabel,
        product: diagText.slice(0, 60),
        dose: "—",
        frequency: "—",
        notes: chief,
        status: "Actual",
        recordId: r.id,
      });
    }
  }

  return { consultations, diagnosisRows, treatmentRows };
}
