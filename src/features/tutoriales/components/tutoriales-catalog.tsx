"use client";

import { BookOpen, Clock3, ListOrdered, Play, Route } from "lucide-react";
import { useMemo, useState } from "react";

import { canAccessRoute, type PermissionOverrides } from "@/core/permissions/roles";

import { useOptionalTutorial } from "@/features/tutoriales/components/tutorial-provider";
import { readAllLocalTutorialProgress } from "@/features/tutoriales/lib/local-progress";
import { buildAcademyCards, listTutorials } from "@/features/tutoriales/registry";
import { TOUR_TARGETS } from "@/features/tutoriales/targets";
import type { TutorialAudienceRole, TutorialProgressStatus } from "@/features/tutoriales/types";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UserRole } from "@/types/database";

const DIFFICULTY_LABEL: Record<string, string> = {
  basico: "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const STATUS_LABEL: Record<TutorialProgressStatus, string> = {
  not_started: "Sin empezar",
  in_progress: "En curso",
  completed: "Completado",
  skipped: "Omitido",
};

function statusVariant(
  status: TutorialProgressStatus
): "default" | "info" | "success" | "warning" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "info";
  if (status === "skipped") return "warning";
  return "default";
}

interface TutorialesCatalogProps {
  audienceRole: TutorialAudienceRole;
  clinicRole: UserRole | null;
  isSuperadmin: boolean;
  permissionOverrides?: PermissionOverrides;
  organizationId: string;
  userId: string;
}

export function TutorialesCatalog({
  audienceRole,
  clinicRole,
  isSuperadmin,
  permissionOverrides,
  organizationId,
  userId,
}: TutorialesCatalogProps) {
  const tutorialApi = useOptionalTutorial();
  const [tick, setTick] = useState(0);

  const cards = useMemo(() => {
    void tick;
    const progress = readAllLocalTutorialProgress(
      organizationId,
      userId,
      listTutorials().map((t) => t.id)
    );
    return buildAcademyCards(audienceRole, progress, {
      canAccessStartRoute: (route) =>
        canAccessRoute(clinicRole, route, isSuperadmin, permissionOverrides),
    });
  }, [
    audienceRole,
    clinicRole,
    isSuperadmin,
    permissionOverrides,
    organizationId,
    userId,
    tick,
  ]);

  return (
    <div data-tour={TOUR_TARGETS.TUTORIALES_ROOT} className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary,var(--foreground))]">
          <BookOpen className="h-5 w-5 text-[var(--primary)]" aria-hidden />
          Tutoriales NexClinic
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted,var(--muted-foreground))]">
          Recorridos guiados sobre pantallas reales de tu clínica. Demostración segura: no se
          crean ni modifican registros clínicos. Solo ves módulos autorizados para tu perfil.
        </p>
      </div>

      {cards.length === 0 ? (
        <Card title="Sin tutoriales disponibles">
          <p className="text-sm text-[var(--text-muted,var(--muted-foreground))]">
            No hay módulos con tutorial habilitado para tu rol o permisos actuales.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const status = card.progress?.status ?? "not_started";
            return (
              <Card
                key={card.tutorialId}
                title={card.title}
                description={card.description}
                className="flex h-full flex-col"
                action={<Badge variant={statusVariant(status)}>{STATUS_LABEL[status]}</Badge>}
              >
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted,var(--muted-foreground))]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-1">
                    {DIFFICULTY_LABEL[card.difficulty] ?? card.difficulty}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    ~{card.estimatedMinutes} min
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-1">
                    <ListOrdered className="h-3.5 w-3.5" aria-hidden />
                    {card.stepCount} pasos
                  </span>
                </div>

                <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-[var(--text-primary,var(--foreground))]">
                  {card.stepTitles.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ol>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      tutorialApi?.start(card.tutorialId, "demo");
                      setTick((n) => n + 1);
                    }}
                    disabled={!tutorialApi}
                  >
                    <Play className="h-4 w-4" aria-hidden />
                    Reproducir
                  </Button>
                  <ButtonLink href={card.startRoute} size="sm" variant="outline">
                    <Route className="h-4 w-4" aria-hidden />
                    Ir al módulo
                  </ButtonLink>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
