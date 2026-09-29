import type { NationalRxReadiness } from "@/core/renapdis/national-readiness";

type Tone = "ok" | "warn" | "bad";

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warn: "bg-amber-50 text-amber-900 border-amber-200",
  bad: "bg-rose-50 text-rose-900 border-rose-200",
};

function Line({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}>{value}</span>
    </div>
  );
}

/** Never renders secrets: only booleans, modes and env var names. */
export function NationalRxReadinessCard({
  readiness,
  showFeature = true,
}: {
  readiness: NationalRxReadiness;
  showFeature?: boolean;
}) {
  const refeps =
    readiness.refepsMode === "official"
      ? { value: "OFICIAL", tone: "ok" as Tone }
      : readiness.refepsMode === "sandbox"
        ? { value: "SANDBOX", tone: "warn" as Tone }
        : { value: "NO CONFIGURADO", tone: "bad" as Tone };
  const repo =
    readiness.repositoryMode === "external"
      ? { value: `EXTERNO (${readiness.repositoryProviderId ?? "?"})`, tone: "ok" as Tone }
      : readiness.repositoryMode === "sandbox"
        ? { value: "SANDBOX", tone: "warn" as Tone }
        : { value: "NO CONFIGURADO", tone: "bad" as Tone };

  return (
    <div className="space-y-1">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <Line label="Entorno" value={readiness.environment.toUpperCase()} tone={readiness.environment === "production" ? "warn" : "ok"} />
        {showFeature ? (
          <Line label="Funcionalidad" value={readiness.featureEnabled ? "ON" : "OFF"} tone={readiness.featureEnabled ? "ok" : "bad"} />
        ) : null}
        {showFeature ? (
          <Line label="Establecimiento" value={readiness.establishmentConfigured ? "CONFIGURADO" : "FALTA"} tone={readiness.establishmentConfigured ? "ok" : "bad"} />
        ) : null}
        <Line label="Validación REFEPS" value={refeps.value} tone={refeps.tone} />
        <Line label="Repositorio ReNaPDiS" value={repo.value} tone={repo.tone} />
        <Line label="Credenciales oficiales" value={readiness.officialCredentials ? "SÍ" : "NO"} tone={readiness.officialCredentials ? "ok" : "bad"} />
        <Line label="CUIR oficial" value={readiness.officialCuirAvailable ? "DISPONIBLE" : "NO DISPONIBLE"} tone={readiness.officialCuirAvailable ? "ok" : "bad"} />
        <Line label="Homologación" value={readiness.homologationConfirmed ? "CONFIRMADA" : "NO CONFIRMADA"} tone={readiness.homologationConfirmed ? "ok" : "bad"} />
        <Line
          label="Resultado"
          value={readiness.readyForNationalPrescription ? "READY" : readiness.readyForSandboxTesting ? "SOLO PRUEBAS (SANDBOX)" : "NOT READY"}
          tone={readiness.readyForNationalPrescription ? "ok" : readiness.readyForSandboxTesting ? "warn" : "bad"}
        />
      </div>
      {readiness.blockers.length > 0 ? (
        <ul className="list-inside list-disc pt-2 text-xs text-slate-600 dark:text-slate-400">
          {readiness.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <p className="pt-2 text-xs text-slate-500">
        Habilitar la funcionalidad no autoriza a emitir recetas nacionales. Las credenciales oficiales del
        repositorio ReNaPDiS y la homologación del Ministerio/proveedor son requisitos externos: NexClinic no las crea.
      </p>
    </div>
  );
}
