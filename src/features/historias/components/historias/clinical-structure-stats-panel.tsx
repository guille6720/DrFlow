type Cie10Row = {
  cie10_code: string;
  diagnosis_name: string;
  occurrence_count: number;
};

type TreatmentRow = {
  product: string;
  active_ingredient: string | null;
  occurrence_count: number;
};

type Props = {
  cie10: Cie10Row[];
  treatments: TreatmentRow[];
};

export function ClinicalStructureStatsPanel({ cie10, treatments }: Props) {
  if (cie10.length === 0 && treatments.length === 0) {
    return (
      <section className="drflow-card-light rounded-lg border border-slate-200 bg-white p-4 text-slate-900">
        <h2 className="text-sm font-semibold text-slate-900">Reportes clínicos estructurados</h2>
        <p className="mt-2 text-sm text-slate-600">
          Todavía no hay diagnósticos CIE-10 ni tratamientos normalizados para reportar. Se
          alimentan al guardar consultas con autocomplete (Fase 2).
        </p>
      </section>
    );
  }

  return (
    <section className="drflow-card-light rounded-lg border border-slate-200 bg-white p-4 text-slate-900">
      <h2 className="text-sm font-semibold text-slate-900">Reportes clínicos estructurados</h2>
      <p className="mt-1 text-sm text-slate-600">
        Frecuencia por CIE-10 y por producto a partir de tablas normalizadas.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Top CIE-10
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {cie10.length === 0 ? (
              <li className="text-slate-500">Sin datos</li>
            ) : (
              cie10.map((row) => (
                <li key={row.cie10_code} className="flex justify-between gap-3">
                  <span>
                    <span className="font-medium">{row.cie10_code}</span>{" "}
                    <span className="text-slate-600">{row.diagnosis_name}</span>
                  </span>
                  <span className="tabular-nums text-slate-500">{row.occurrence_count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Top tratamientos
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {treatments.length === 0 ? (
              <li className="text-slate-500">Sin datos</li>
            ) : (
              treatments.map((row) => (
                <li key={row.product} className="flex justify-between gap-3">
                  <span>
                    <span className="font-medium">{row.product}</span>
                    {row.active_ingredient ? (
                      <span className="text-slate-600"> · {row.active_ingredient}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-slate-500">{row.occurrence_count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
