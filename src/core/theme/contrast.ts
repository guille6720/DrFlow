/**
 * WCAG contrast helpers for DrFlow theme tokens (unit-testable).
 * Relative luminance + contrast ratio per WCAG 2.x.
 *
 * Targets (medical UI prefers ≥ minimum):
 * - Normal text: 4.5:1 (AA)
 * - Large/bold text (≥18pt / 14pt bold): 3:1 (AA)
 * - UI controls / icons / borders that convey info: 3:1 (AA non-text)
 */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastRole = "text" | "largeText" | "ui";

export function requiredRatio(role: ContrastRole): number {
  if (role === "text") return 4.5;
  return 3;
}

export function meetsWcagAa(
  fg: string,
  bg: string,
  role: ContrastRole | boolean = "text"
): boolean {
  const resolved: ContrastRole =
    typeof role === "boolean" ? (role ? "largeText" : "text") : role;
  return contrastRatio(fg, bg) >= requiredRatio(resolved);
}

/** Canonical readable pairs used by DrFlow official palettes (must stay AA). */
export const THEME_CONTRAST_PAIRS: Array<{
  id: string;
  fg: string;
  bg: string;
  role?: ContrastRole;
  /** @deprecated use role */
  large?: boolean;
}> = [
  // Clinical Blue light
  { id: "cb-light-primary", fg: "#172033", bg: "#F6F9FC" },
  { id: "cb-light-secondary", fg: "#667085", bg: "#FFFFFF" },
  { id: "cb-light-muted", fg: "#667085", bg: "#F6F9FC" },
  { id: "cb-light-btn", fg: "#FFFFFF", bg: "#1677FF", role: "largeText" },
  { id: "cb-light-btn-hover", fg: "#FFFFFF", bg: "#0D63D8", role: "largeText" },
  { id: "cb-light-danger", fg: "#FFFFFF", bg: "#D92D20", role: "largeText" },
  { id: "cb-light-sidebar", fg: "#E8EEF6", bg: "#0B2748" },
  // Clinical Blue dark
  { id: "cb-dark-primary", fg: "#F3F7FC", bg: "#08111F" },
  { id: "cb-dark-on-card", fg: "#F3F7FC", bg: "#101B2D" },
  { id: "cb-dark-secondary", fg: "#AAB7C8", bg: "#101B2D" },
  { id: "cb-dark-muted", fg: "#AAB7C8", bg: "#101B2D" },
  { id: "cb-dark-btn", fg: "#08111F", bg: "#4D9CFF", role: "largeText" },
  { id: "cb-dark-btn-hover", fg: "#08111F", bg: "#72B1FF", role: "largeText" },
  { id: "cb-dark-selected", fg: "#F3F7FC", bg: "#14345C" },
  // Medical Slate light
  { id: "ms-light-primary", fg: "#182230", bg: "#F7F8FA" },
  { id: "ms-light-secondary", fg: "#667085", bg: "#FFFFFF" },
  { id: "ms-light-muted", fg: "#667085", bg: "#F7F8FA" },
  { id: "ms-light-btn", fg: "#FFFFFF", bg: "#2563EB", role: "largeText" },
  { id: "ms-light-accent", fg: "#FFFFFF", bg: "#7057D9", role: "largeText" },
  { id: "ms-light-sidebar", fg: "#E8EDF3", bg: "#182230" },
  // Medical Slate dark
  { id: "ms-dark-primary", fg: "#F4F6F8", bg: "#0D1117" },
  { id: "ms-dark-on-card", fg: "#F4F6F8", bg: "#161B22" },
  { id: "ms-dark-secondary", fg: "#A7B0BE", bg: "#161B22" },
  { id: "ms-dark-muted", fg: "#A7B0BE", bg: "#161B22" },
  { id: "ms-dark-btn", fg: "#0D1117", bg: "#5B8CFF", role: "largeText" },
  { id: "ms-dark-selected", fg: "#F4F6F8", bg: "#1E3A5F" },
  { id: "ms-dark-input-border", fg: "#A7B0BE", bg: "#12171E", role: "ui" },
  { id: "ms-dark-focus-ring", fg: "#5B8CFF", bg: "#0D1117", role: "ui" },  // Forms
  { id: "form-light-value", fg: "#172033", bg: "#FFFFFF" },
  { id: "form-light-label", fg: "#667085", bg: "#FFFFFF" },
  { id: "form-light-placeholder", fg: "#667085", bg: "#FFFFFF" },
  { id: "form-light-error", fg: "#D92D20", bg: "#FFFFFF" },
  { id: "form-dark-value", fg: "#F3F7FC", bg: "#0E1A2C" },
  { id: "form-dark-label", fg: "#AAB7C8", bg: "#101B2D" },
  { id: "form-dark-placeholder", fg: "#AAB7C8", bg: "#0E1A2C" },
  { id: "form-dark-error", fg: "#FF6B64", bg: "#101B2D" },
  // Selected
  { id: "sel-clinical-card", fg: "#0B2748", bg: "#E8F1FF" },
  { id: "sel-slate-card", fg: "#182230", bg: "#E8EFFC" },
  { id: "sel-dark-nav", fg: "#F3F7FC", bg: "#14345C" },
];
