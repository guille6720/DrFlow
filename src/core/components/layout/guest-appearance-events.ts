export const GUEST_APPEARANCE_OPEN_EVENT = "drflow:open-guest-appearance";

export function openGuestAppearanceModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GUEST_APPEARANCE_OPEN_EVENT));
}
