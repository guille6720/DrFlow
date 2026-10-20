import { tourSelector } from "@/features/tutoriales/targets";

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export async function waitForTarget(
  target: string | undefined,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<{ rect: DOMRect | null; missing: boolean; element: Element | null }> {
  if (!target || typeof document === "undefined") {
    return { rect: null, missing: Boolean(target), element: null };
  }
  const timeoutMs = options.timeoutMs ?? 2200;
  const intervalMs = options.intervalMs ?? 80;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const el = document.querySelector(tourSelector(target));
    if (el) {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      const rect = el.getBoundingClientRect();
      return { rect, missing: false, element: el };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { rect: null, missing: true, element: null };
}
