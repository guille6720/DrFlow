import { describe, expect, it } from "vitest";

import { canAccessRoute } from "@/core/permissions/roles";

import { FEATURE_NAV_ITEMS, getFeatureModule } from "@/features/_shared";
import { buildStandardModuleTutorial } from "@/features/tutoriales/definitions/build-module-tutorial";
import { buildProgressPatch } from "@/features/tutoriales/lib/local-progress";
import {
  AGENDA_BASICO_TUTORIAL,
  buildAcademyCards,
  getTutorialById,
  listTutorials,
  listTutorialsForRole,
} from "@/features/tutoriales/registry";
import { pathsMatch, resolveTutorialRoute } from "@/features/tutoriales/resolve-route";
import { normalizeSpokenText } from "@/features/tutoriales/spoken-text";
import { TOUR_TARGETS, tourSelector } from "@/features/tutoriales/targets";

describe("tutoriales registry", () => {
  it("registers agenda básico with real NexClinic routes and targets", () => {
    const tutorial = getTutorialById("agenda-basico");
    expect(tutorial).not.toBeNull();
    expect(tutorial?.startRoute).toBe("/turnos/agenda");
    expect(tutorial?.steps.length).toBeGreaterThanOrEqual(3);
    expect(tutorial?.steps.some((s) => s.id === "welcome")).toBe(true);
    expect(tutorial?.steps.some((s) => s.id === "closing")).toBe(true);
    expect(tutorial?.title.toLowerCase()).toContain("agenda");
    expect(JSON.stringify(tutorial)).not.toMatch(/SyncVete|veterinar|mascota|canino/i);
    const targets = tutorial!.steps.map((s) => s.target).filter(Boolean);
    expect(targets).toContain(TOUR_TARGETS.AGENDA_HEADER);
    expect(targets).toContain(TOUR_TARGETS.AGENDA_NEW_BUTTON);
  });

  it("registers clinic modules except superadmin and keeps safe demos", () => {
    const all = listTutorials();
    expect(all.length).toBeGreaterThanOrEqual(20);
    expect(all.some((t) => t.id === "pacientes-basico")).toBe(true);
    expect(all.some((t) => t.id === "dashboard-basico")).toBe(true);
    expect(all.some((t) => t.id === "caja-basico")).toBe(true);
    expect(all.every((t) => !t.startRoute.startsWith("/superadmin"))).toBe(true);
    expect(all.every((t) => !/superadmin/i.test(t.moduleId))).toBe(true);
    expect(JSON.stringify(all)).not.toMatch(/SyncVete|veterinar|mascota|canino/i);

    for (const tutorial of all) {
      expect(tutorial.steps.some((s) => s.id === "welcome")).toBe(true);
      expect(tutorial.steps.some((s) => s.id === "closing")).toBe(true);
      expect(tutorial.steps.length).toBeGreaterThanOrEqual(3);
      const headerTarget = `${tutorial.moduleId}-header`;
      const welcome = tutorial.steps.find((s) => s.id === "welcome");
      expect(welcome?.target).toBe(
        tutorial.moduleId === "agenda" ? TOUR_TARGETS.AGENDA_HEADER : headerTarget
      );
    }
  });

  it("filters by role and excludes patient audience", () => {
    expect(listTutorialsForRole("doctor").length).toBeGreaterThan(0);
    expect(listTutorialsForRole("secretary").some((t) => t.id === "agenda-basico")).toBe(true);
    expect(AGENDA_BASICO_TUTORIAL.audienceRoles).not.toContain("patient" as never);
  });

  it("buildAcademyCards includes numbered step titles and progress", () => {
    const cards = buildAcademyCards("clinic_admin", {
      "agenda-basico": {
        tutorialId: "agenda-basico",
        tutorialVersion: 1,
        currentStepIndex: 2,
        status: "in_progress",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const agendaCard = cards.find((c) => c.tutorialId === "agenda-basico");
    expect(agendaCard?.stepTitles.length).toBe(AGENDA_BASICO_TUTORIAL.steps.length);
    expect(agendaCard?.progress?.status).toBe("in_progress");
    expect(cards.length).toBe(listTutorialsForRole("clinic_admin").length);
  });
});

describe("tutoriales generators and helpers", () => {
  it("buildStandardModuleTutorial produces welcome, actions and closing", () => {
    const def = buildStandardModuleTutorial({
      moduleId: "pacientes",
      startRoute: "/pacientes",
      titleName: "Pacientes",
      description: "Demo",
      actions: [
        {
          id: "search",
          title: "Buscar",
          body: "Usá el buscador",
          narration: "Buscá un paciente de demostración.",
        },
      ],
    });
    expect(def.id).toBe("pacientes-basico");
    expect(def.steps.map((s) => s.id)).toEqual(["welcome", "search", "closing"]);
    expect(def.steps[1]?.target).toBe("pacientes-search");
    expect(def.videoScenes.length).toBe(3);
  });

  it("normalizeSpokenText softens brand and routes for TTS", () => {
    expect(normalizeSpokenText("Abrí /turnos/agenda en NexClinic")).toContain("Nex Clinic");
    expect(normalizeSpokenText("Abrí /turnos/agenda en NexClinic")).toContain("agenda de turnos");
  });

  it("tourSelector and pathsMatch behave", () => {
    expect(tourSelector("agenda-root")).toBe('[data-tour="agenda-root"]');
    expect(pathsMatch("/turnos/agenda", "/turnos/agenda")).toBe(true);
    expect(pathsMatch("/turnos/agenda?view=day", "/turnos/agenda")).toBe(false);
  });

  it("resolveTutorialRoute navigates and respects permissions", () => {
    const step = AGENDA_BASICO_TUTORIAL.steps.find((s) => s.id === "new-button")!;
    const blocked = resolveTutorialRoute({
      tutorial: AGENDA_BASICO_TUTORIAL,
      step,
      pathname: "/turnos/agenda",
      hasPermission: () => false,
    });
    expect(blocked.kind).toBe("blocked-permission");

    const nav = resolveTutorialRoute({
      tutorial: AGENDA_BASICO_TUTORIAL,
      step: { ...AGENDA_BASICO_TUTORIAL.steps[0]!, route: "/turnos/agenda" },
      pathname: "/tutoriales",
      hasPermission: () => true,
    });
    expect(nav).toEqual({ kind: "navigate", href: "/turnos/agenda" });
  });

  it("buildProgressPatch isolates completed status", () => {
    const patch = buildProgressPatch({
      tutorialId: "agenda-basico",
      tutorialVersion: 1,
      currentStepIndex: 5,
      status: "completed",
      previous: null,
    });
    expect(patch.status).toBe("completed");
    expect(patch.completedAt).toBeTruthy();
  });
});

describe("tutoriales nav integration", () => {
  it("exposes /tutoriales in feature nav with known module", () => {
    const item = FEATURE_NAV_ITEMS.find((n) => n.href === "/tutoriales");
    expect(item?.label).toBe("Tutoriales");
    expect(item?.featureId).toBe("tutoriales");
    expect(getFeatureModule("tutoriales").routes).toContain("/tutoriales");
  });

  it("staff roles can open /tutoriales and /turnos/agenda", () => {
    expect(canAccessRoute("doctor", "/tutoriales", false)).toBe(true);
    expect(canAccessRoute("secretary", "/turnos/agenda", false)).toBe(true);
  });
});
