/**
 * WCAG contrast helpers for DrFlow theme tokens (unit-testable).
 * Relative luminance + contrast ratio per WCAG 2.x.
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

export function meetsWcagAa(fg: string, bg: string, largeText = false): boolean {
  return contrastRatio(fg, bg) >= (largeText ? 3 : 4.5);
}

/** Canonical readable pairs used by DrFlow palettes (must stay AA). */
export const THEME_CONTRAST_PAIRS: Array<{
  id: string;
  fg: string;
  bg: string;
  large?: boolean;
}> = [
  // Style 2 light
  { id: "s2-light-primary", fg: "#0F172A", bg: "#F8FAFC" },
  { id: "s2-light-secondary", fg: "#334155", bg: "#FFFFFF" },
  { id: "s2-light-muted", fg: "#475569", bg: "#FFFFFF" },
  { id: "s2-light-placeholder", fg: "#64748B", bg: "#FFFFFF" },
  { id: "s2-light-btn", fg: "#FFFFFF", bg: "#0F4C5C" },
  // Style 2 dark
  { id: "s2-dark-primary", fg: "#F8FAFC", bg: "#0B1220" },
  { id: "s2-dark-secondary", fg: "#CBD5E1", bg: "#111827" },
  { id: "s2-dark-muted", fg: "#94A3B8", bg: "#111827" },
  { id: "s2-dark-btn", fg: "#0B1220", bg: "#2DD4BF" },
  // Midnight dark
  { id: "mn-dark-primary", fg: "#F8FAFC", bg: "#07182D" },
  { id: "mn-dark-on-card", fg: "#F8FAFC", bg: "#102845" },
  { id: "mn-dark-secondary", fg: "#CBD5E1", bg: "#102845" },
  { id: "mn-dark-muted", fg: "#94A3B8", bg: "#102845" },
  { id: "mn-dark-placeholder", fg: "#94A3B8", bg: "#0A1D36" },
  { id: "mn-dark-btn", fg: "#061426", bg: "#5CB8F6" },
  { id: "mn-dark-selected", fg: "#F8FAFC", bg: "#183858" },
  // Midnight light
  { id: "mn-light-primary", fg: "#0F172A", bg: "#E8EEF6" },
  { id: "mn-light-on-card", fg: "#0F172A", bg: "#FFFFFF" },
  { id: "mn-light-secondary", fg: "#334155", bg: "#FFFFFF" },
  { id: "mn-light-selected", fg: "#0F172A", bg: "#DBEAFE" },
  // Soft clinic light/dark
  { id: "sc-light-primary", fg: "#111827", bg: "#F9FAFB" },
  { id: "sc-dark-primary", fg: "#F8FAFC", bg: "#0B1118" },
  { id: "sc-dark-secondary", fg: "#CBD5E1", bg: "#121A24" },
  // Azure
  { id: "az-light-primary", fg: "#0A1628", bg: "#E8F2FC" },
  { id: "az-dark-primary", fg: "#F0F9FF", bg: "#061323" },
  { id: "az-dark-on-card", fg: "#F0F9FF", bg: "#0C1F38" },
  // Cobalt — page chrome (light text on blue) + white cards (dark text)
  { id: "co-page", fg: "#F8FAFC", bg: "#2563EB" },
  { id: "co-card-primary", fg: "#0F172A", bg: "#FFFFFF" },
  { id: "co-card-secondary", fg: "#334155", bg: "#FFFFFF" },
  // Selected accent soft (light mint) must use dark text
  { id: "selected-mint", fg: "#0F172A", bg: "#ECFDF5" },
  { id: "selected-sky", fg: "#0F172A", bg: "#E0F2FE" },
];
