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

/** Canonical readable pairs used by DrFlow palettes (must stay AA). */
export const THEME_CONTRAST_PAIRS: Array<{
  id: string;
  fg: string;
  bg: string;
  role?: ContrastRole;
  /** @deprecated use role */
  large?: boolean;
}> = [
  // Style 2 light
  { id: "s2-light-primary", fg: "#0F172A", bg: "#F8FAFC" },
  { id: "s2-light-secondary", fg: "#334155", bg: "#FFFFFF" },
  { id: "s2-light-muted", fg: "#475569", bg: "#FFFFFF" },
  { id: "s2-light-muted-page", fg: "#475569", bg: "#F8FAFC" },
  { id: "s2-light-placeholder", fg: "#64748B", bg: "#FFFFFF" },
  { id: "s2-light-btn", fg: "#FFFFFF", bg: "#0F4C5C" },
  { id: "s2-light-btn-hover", fg: "#FFFFFF", bg: "#0C3D4A" },
  { id: "s2-light-danger", fg: "#FFFFFF", bg: "#B91C1C" },
  { id: "s2-light-outline", fg: "#0F172A", bg: "#FFFFFF" },
  { id: "s2-light-ghost-hover", fg: "#0F172A", bg: "#F1F5F9" },
  { id: "s2-light-no-white-on-white", fg: "#0F172A", bg: "#FFFFFF" },
  // Style 2 dark
  { id: "s2-dark-primary", fg: "#F8FAFC", bg: "#0F172A" },
  { id: "s2-dark-on-card", fg: "#F8FAFC", bg: "#1E293B" },
  { id: "s2-dark-secondary", fg: "#CBD5E1", bg: "#1E293B" },
  { id: "s2-dark-muted", fg: "#A8B6C8", bg: "#1E293B" },
  { id: "s2-dark-on-input", fg: "#F8FAFC", bg: "#162032" },
  { id: "s2-dark-selected", fg: "#F8FAFC", bg: "#134E4A" },
  { id: "s2-dark-btn", fg: "#0B1220", bg: "#2DD4BF" },
  { id: "s2-dark-btn-hover", fg: "#0B1220", bg: "#14B8A6" },
  // Midnight dark
  { id: "mn-dark-primary", fg: "#F8FAFC", bg: "#07182D" },
  { id: "mn-dark-on-card", fg: "#F8FAFC", bg: "#102845" },
  { id: "mn-dark-secondary", fg: "#CBD5E1", bg: "#102845" },
  { id: "mn-dark-muted", fg: "#A8B6C8", bg: "#102845" },
  { id: "mn-dark-placeholder", fg: "#A8B6C8", bg: "#0A1D36" },
  { id: "mn-dark-btn", fg: "#061426", bg: "#5CB8F6" },
  { id: "mn-dark-btn-hover", fg: "#061426", bg: "#3AA0E8" },
  { id: "mn-dark-selected", fg: "#F8FAFC", bg: "#1C4064" },
  { id: "mn-dark-hover", fg: "#F8FAFC", bg: "#183858" },
  { id: "mn-dark-input-border", fg: "#64748B", bg: "#0A1D36", role: "ui" },
  { id: "mn-dark-focus-ring", fg: "#5CB8F6", bg: "#0A1D36", role: "ui" },
  { id: "mn-dark-icon-accent", fg: "#5CB8F6", bg: "#07182D", role: "ui" },
  // Midnight light
  { id: "mn-light-primary", fg: "#0F172A", bg: "#E8EEF6" },
  { id: "mn-light-on-card", fg: "#0F172A", bg: "#FFFFFF" },
  { id: "mn-light-secondary", fg: "#334155", bg: "#FFFFFF" },
  { id: "mn-light-muted", fg: "#475569", bg: "#E8EEF6" },
  { id: "mn-light-selected", fg: "#0F172A", bg: "#DBEAFE" },
  // Soft clinic light/dark
  { id: "sc-light-primary", fg: "#0F172A", bg: "#F9FAFB" },
  { id: "sc-light-secondary", fg: "#334155", bg: "#FFFFFF" },
  { id: "sc-light-muted", fg: "#475569", bg: "#F9FAFB" },
  { id: "sc-light-pastel-teal", fg: "#0F172A", bg: "#CCFBF1" },
  { id: "sc-light-btn", fg: "#FFFFFF", bg: "#0F766E" },
  { id: "sc-light-btn-hover", fg: "#FFFFFF", bg: "#115E59" },
  { id: "sc-light-nav-active", fg: "#FFFFFF", bg: "#0F766E" },
  { id: "sc-dark-primary", fg: "#F8FAFC", bg: "#0F1720" },
  { id: "sc-dark-on-card", fg: "#F8FAFC", bg: "#1A2430" },
  { id: "sc-dark-secondary", fg: "#CBD5E1", bg: "#1A2430" },
  { id: "sc-dark-muted", fg: "#A8B6C8", bg: "#1A2430" },
  { id: "sc-dark-selected", fg: "#F8FAFC", bg: "#134E4A" },
  { id: "sc-dark-nav-active", fg: "#FFFFFF", bg: "#0F766E" },
  // Azure light/dark
  { id: "az-light-primary", fg: "#0F172A", bg: "#E8F2FC" },
  { id: "az-light-secondary", fg: "#334155", bg: "#FFFFFF" },
  { id: "az-light-muted", fg: "#475569", bg: "#E8F2FC" },
  { id: "az-dark-primary", fg: "#F8FAFC", bg: "#0A1628" },
  { id: "az-dark-on-card", fg: "#F8FAFC", bg: "#102845" },
  { id: "az-dark-secondary", fg: "#CBD5E1", bg: "#102845" },
  { id: "az-dark-muted", fg: "#A8B6C8", bg: "#102845" },
  { id: "az-dark-selected", fg: "#F8FAFC", bg: "#0C4A6E" },
  { id: "az-dark-hover", fg: "#F8FAFC", bg: "#183858" },
  { id: "az-sidebar-nav", fg: "#E0F2FE", bg: "#0C4A6E" },
  // Cobalt — page chrome (≥4.5) + white cards
  { id: "co-page-primary", fg: "#FFFFFF", bg: "#2563EB" },
  { id: "co-page-secondary", fg: "#F1F5F9", bg: "#2563EB" },
  { id: "co-page-muted", fg: "#EFF6FF", bg: "#2563EB" },
  { id: "co-card-primary", fg: "#0F172A", bg: "#FFFFFF" },
  { id: "co-card-secondary", fg: "#334155", bg: "#FFFFFF" },
  { id: "co-card-muted", fg: "#475569", bg: "#FFFFFF" },
  { id: "co-btn-primary", fg: "#1D4ED8", bg: "#FFFFFF" },
  { id: "co-btn-primary-hover", fg: "#1E40AF", bg: "#EFF6FF" },
  { id: "co-btn-primary-disabled", fg: "#1E40AF", bg: "#E2E8F0" },
  { id: "co-dark-page-primary", fg: "#F8FAFC", bg: "#1E3A8A" },
  { id: "co-dark-page-secondary", fg: "#F1F5F9", bg: "#1E3A8A" },
  // Forms — values / placeholders / helpers / errors on input surfaces
  { id: "form-light-value", fg: "#0F172A", bg: "#FFFFFF" },
  { id: "form-light-label", fg: "#334155", bg: "#FFFFFF" },
  { id: "form-light-placeholder", fg: "#64748B", bg: "#FFFFFF" },
  { id: "form-light-helper", fg: "#475569", bg: "#FFFFFF" },
  { id: "form-light-error", fg: "#B91C1C", bg: "#FFFFFF" },
  { id: "form-dark-value", fg: "#F8FAFC", bg: "#0A1D36" },
  { id: "form-dark-label", fg: "#CBD5E1", bg: "#102845" },
  { id: "form-dark-placeholder", fg: "#A8B6C8", bg: "#0A1D36" },
  { id: "form-dark-helper", fg: "#A8B6C8", bg: "#102845" },
  { id: "form-dark-error", fg: "#F87171", bg: "#102845" },
  { id: "form-disabled-light", fg: "#475569", bg: "#F1F5F9" },
  // Selected states — pale surfaces need dark ink; saturated need light ink
  { id: "sel-mint-card", fg: "#0F172A", bg: "#ECFDF5" },
  { id: "sel-sky-card", fg: "#0F172A", bg: "#E0F2FE" },
  { id: "sel-blue-chip", fg: "#1D4ED8", bg: "#EFF6FF" },
  { id: "sel-softclinic-nav", fg: "#FFFFFF", bg: "#0F766E" },
  { id: "sel-tab-active", fg: "#FFFFFF", bg: "#0F766E" },
  { id: "sel-dark-nav", fg: "#F8FAFC", bg: "#134E4A" },
  // Selected accent soft (light mint) must use dark text
  { id: "selected-mint", fg: "#0F172A", bg: "#ECFDF5" },
  { id: "selected-sky", fg: "#0F172A", bg: "#E0F2FE" },
];
