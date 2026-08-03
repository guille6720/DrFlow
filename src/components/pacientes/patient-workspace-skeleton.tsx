export function PatientWorkspaceSkeleton() {
  return (
    <div className="drflow-patient-workspace-skeleton" aria-busy="true" aria-label="Cargando historia clínica">
      <div className="drflow-patient-workspace-skeleton-tabs">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="drflow-patient-workspace-skeleton-pill" />
        ))}
      </div>
      <div className="drflow-patient-workspace-skeleton-panel">
        <span className="drflow-patient-workspace-skeleton-line is-title" />
        <span className="drflow-patient-workspace-skeleton-line" />
        <span className="drflow-patient-workspace-skeleton-line" />
        <span className="drflow-patient-workspace-skeleton-line is-short" />
      </div>
    </div>
  );
}
