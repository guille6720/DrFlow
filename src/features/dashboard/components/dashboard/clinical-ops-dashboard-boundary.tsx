"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  failed: boolean;
};

function ClinicalOpsCrashFallback() {
  return (
    <section className="clinical-ops-center drflow-ui-card space-y-4 p-4">
      <p className="text-sm font-medium text-slate-800">
        No pudimos cargar operaciones del día. Refrescá la página o probá de nuevo en unos segundos.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {["En espera", "Atendidos", "Espera prom.", "Próximo turno", "Demorados"].map((label) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs text-slate-600">{label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">—</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Keeps dashboard shell alive if a clinical ops widget throws. */
export class ClinicalOpsDashboardBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[clinical-ops-dashboard]", error.message, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? <ClinicalOpsCrashFallback />;
    }

    return this.props.children;
  }
}
