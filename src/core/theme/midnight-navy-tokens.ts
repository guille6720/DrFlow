/**
 * Midnight Navy — DrFlow design tokens (charts, badges, series).
 * CSS variables live in midnight-navy.css; keep HEX in sync.
 */
export const MIDNIGHT_NAVY = {
  background: "#07182D",
  backgroundDeep: "#051326",
  sidebar: "#0A1D36",
  topbar: "#0C213C",
  surface: "#102845",
  surfaceElevated: "#142F50",
  surfaceHover: "#183858",
  surfaceActive: "#1C4064",
  border: "#203B59",
  borderSubtle: "#19344F",
  borderStrong: "#2A4A69",
  textPrimary: "#F4F7FC",
  textSecondary: "#A9B8CB",
  textMuted: "#71849D",
  textDisabled: "#53657B",
  accentBlue: "#5CB8F6",
  accentPurple: "#8457F4",
  accentMagenta: "#F84FA3",
  accentAmber: "#FFBC58",
  accentCyan: "#56D3DE",
  accentGreen: "#55D6A8",
  success: "#55D6A8",
  warning: "#FFBC58",
  danger: "#FF667A",
  info: "#5CB8F6",
  chartGrid: "#2A4663",
  overlay: "rgba(2, 10, 20, 0.72)",
} as const;

/** Series order for charts — do not invent ad-hoc colors. */
export const MIDNIGHT_CHART_SERIES = [
  MIDNIGHT_NAVY.accentBlue,
  MIDNIGHT_NAVY.accentPurple,
  MIDNIGHT_NAVY.accentMagenta,
  MIDNIGHT_NAVY.accentAmber,
  MIDNIGHT_NAVY.accentCyan,
  MIDNIGHT_NAVY.accentGreen,
] as const;
