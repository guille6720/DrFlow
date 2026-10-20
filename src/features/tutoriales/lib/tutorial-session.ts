export interface TutorialSessionSnapshot {
  tutorialId: string;
  mode: "interactive" | "demo";
  stepIndex: number;
  organizationId: string;
  userId: string;
  updatedAt: string;
}

const SESSION_KEY = "nexclinic-tutorial-session-v1";

export function readTutorialSession(): TutorialSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TutorialSessionSnapshot;
  } catch {
    return null;
  }
}

export function writeTutorialSession(snapshot: TutorialSessionSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function clearTutorialSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
