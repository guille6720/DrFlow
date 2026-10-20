import type { UserRole } from "@/types/database";

export type TutorialDifficulty = "basico" | "intermedio" | "avanzado";
export type TutorialPlacement = "top" | "bottom" | "left" | "right" | "center" | "auto";
export type TutorialProgressStatus = "not_started" | "in_progress" | "completed" | "skipped";
export type TutorialMode = "interactive" | "demo";

/** Stable target keys mapped to data-tour attributes in the UI. */
export type TutorialTargetKey = string;

export type TutorialAudienceRole = Exclude<UserRole, "patient">;

export interface TutorialValidation {
  requireTarget?: boolean;
  /** PermissionKey the viewer must hold for this step to be relevant. */
  requirePermission?: string;
}

export interface TutorialAnimationSpec {
  preset: "cursor-highlight" | "intro-logo" | "none";
  durationMs?: number;
  cursor?: boolean;
  spotlightPulse?: boolean;
}

export interface DemoScene {
  id: string;
  headline: string;
  body: string;
  mockLabels?: Record<string, string>;
  durationMs?: number;
  narration?: string;
  animation?: TutorialAnimationSpec;
}

export interface VideoScene {
  id: string;
  order: number;
  title: string;
  narration: string;
  caption: string;
  durationSec: number;
  layoutNotes?: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  target?: TutorialTargetKey;
  placement?: TutorialPlacement;
  route?: string;
  validation?: TutorialValidation;
  demoSceneId?: string;
  videoSceneId?: string;
  narration?: string;
  caption?: string;
  animation?: TutorialAnimationSpec;
}

export interface TutorialDefinition {
  id: string;
  moduleId: string;
  version: number;
  title: string;
  description: string;
  audienceRoles: TutorialAudienceRole[];
  estimatedMinutes: number;
  difficulty: TutorialDifficulty;
  steps: TutorialStep[];
  demoScenes: DemoScene[];
  videoScenes: VideoScene[];
  startRoute: string;
}

export interface TutorialProgress {
  tutorialId: string;
  tutorialVersion: number;
  currentStepIndex: number;
  status: TutorialProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface AcademyModuleCard {
  tutorialId: string;
  moduleId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: TutorialDifficulty;
  startRoute: string;
  stepTitles: string[];
  stepCount: number;
  progress: TutorialProgress | null;
}
