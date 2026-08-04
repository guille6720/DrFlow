/**
 * Versión de producto + changelog.
 * Al publicar cambios: subí `version` en package.json y agregá un ítem acá.
 * Eso actualiza el manual, el PDF y dispara el aviso a médicos (web/PWA).
 */
import packageJson from "../../package.json";

export type ChangelogItem = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogItem[] = [
  {
    version: "0.2.1",
    date: "2026-08-03",
    title: "Recetas y órdenes por paciente, ingreso de profesionales y consulta unificada",
    highlights: [
      "Hub Recetas y órdenes: buscá paciente, emití receta u orden en un solo lugar",
      "Ingreso de profesionales con panel lateral, perfil, consultorio y rangos horarios",
      "Registro de consulta con un solo campo Evolución y firma automática del médico",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-07-15",
    title: "Manual del médico, aviso de actualizaciones y menú clínico limpio",
    highlights: [
      "Nuevo manual in-app con PDF descargable en Ayuda",
      "Aviso automático cuando hay una versión nueva (web y celular/PWA)",
      "Menú sin Telemedicina, Pagos ni Checklist QA",
      "Atender ahora, renovación de medicación y copy PAMI condicional",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-01",
    title: "MVP DrFlow para consultorio",
    highlights: [
      "Agenda, pacientes, historia clínica y recetas",
      "Portal paciente PWA y turnos públicos",
      "Guía PAMI y farmacología por síntomas",
    ],
  },
];

export function getAppVersion(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  return packageJson.version;
}

export function getBuildId(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    getAppVersion()
  );
}

export function getLatestChangelog(): ChangelogItem {
  return CHANGELOG[0];
}

export function getReleasePayload() {
  const latest = getLatestChangelog();
  return {
    version: getAppVersion(),
    buildId: getBuildId(),
    releasedAt: latest.date,
    title: latest.title,
    highlights: latest.highlights,
    manualUpdatedAt: latest.date,
  };
}
