"use client";

import { useMemo, useState } from "react";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";

export function usePatientChartMedicationFilter(chart: PatientChartPayload) {
  const [medSearch, setMedSearch] = useState("");
  const filteredMeds = useMemo(
    () =>
      chart.medications.filter((m) =>
        medSearch.trim() ? m.name.toLowerCase().includes(medSearch.toLowerCase()) : true
      ),
    [chart.medications, medSearch]
  );
  return { medSearch, setMedSearch, filteredMeds };
}
