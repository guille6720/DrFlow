const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Returns focusable elements within a container, in DOM order. */
export function getFocusableElements(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
}

/** Moves focus to the first focusable element inside a container. */
export function focusFirstElement(container: ParentNode): boolean {
  const [first] = getFocusableElements(container);
  if (!first) return false;
  first.focus();
  return true;
}
