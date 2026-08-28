"use client";

import dynamic from "next/dynamic";

const GeminiWorkspace = dynamic(
  () =>
    import("@/features/ia/components/clinical-workflow/gemini-workspace").then((mod) => ({
      default: mod.GeminiWorkspace,
    })),
  {
    ssr: false,
    loading: () => <p className="text-sm text-slate-600">Cargando Gemini…</p>,
  }
);

export function GeminiWorkspaceClient({ clinicId }: { clinicId: string }) {
  return <GeminiWorkspace clinicId={clinicId} />;
}
