"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Catches client render errors in the dashboard shell (layout-level). */
export class DashboardClientErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[dashboard-client-boundary]", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
          <h1 className="text-lg font-semibold text-white">No pudimos cargar el panel</h1>
          <p className="max-w-md text-sm text-slate-400">
            Hubo un error en el navegador. Probá recargar o volvé al login.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white"
              onClick={() => this.setState({ failed: false })}
            >
              Reintentar
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200"
              onClick={() => window.location.assign("/login")}
            >
              Ir al login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
