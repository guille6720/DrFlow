"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
};

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
      return (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-6">
          <p className="text-sm text-amber-200">
            No pudimos cargar operaciones del día. Refrescá la página o probá de nuevo en unos
            segundos.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
