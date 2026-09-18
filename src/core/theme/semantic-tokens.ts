/**
 * NexClinic semantic token contract.
 * CSS values live in `official-palettes.css` + `semantic-tokens.css`.
 */

export const SEMANTIC_TEXT_TOKENS = [
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--text-disabled",
  "--text-on-primary",
  "--text-on-secondary",
  "--text-on-accent",
  "--text-on-card",
  "--text-on-sidebar",
  "--text-on-selected",
] as const;

export const SEMANTIC_SURFACE_TOKENS = [
  "--surface-page",
  "--surface-card",
  "--surface-elevated",
  "--surface-sidebar",
  "--surface-input",
  "--surface-hover",
  "--surface-selected",
] as const;

export const SEMANTIC_BORDER_TOKENS = ["--border-default", "--border-strong"] as const;

export const SEMANTIC_TOKEN_CSS_VARS = [
  ...SEMANTIC_TEXT_TOKENS,
  ...SEMANTIC_SURFACE_TOKENS,
  ...SEMANTIC_BORDER_TOKENS,
] as const;

export type SemanticTokenCssVar = (typeof SEMANTIC_TOKEN_CSS_VARS)[number];

/** Official palette ids that must define the full semantic set in CSS. */
export const SEMANTIC_PALETTE_IDS = ["clinical-blue", "medical-slate"] as const;

export type SemanticPaletteId = (typeof SEMANTIC_PALETTE_IDS)[number];

export const semanticVar = {
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textDisabled: "var(--text-disabled)",
  textOnPrimary: "var(--text-on-primary)",
  textOnSecondary: "var(--text-on-secondary)",
  textOnAccent: "var(--text-on-accent)",
  textOnCard: "var(--text-on-card)",
  textOnSidebar: "var(--text-on-sidebar)",
  textOnSelected: "var(--text-on-selected)",
  surfacePage: "var(--surface-page)",
  surfaceCard: "var(--surface-card)",
  surfaceElevated: "var(--surface-elevated)",
  surfaceSidebar: "var(--surface-sidebar)",
  surfaceInput: "var(--surface-input)",
  surfaceHover: "var(--surface-hover)",
  surfaceSelected: "var(--surface-selected)",
  borderDefault: "var(--border-default)",
  borderStrong: "var(--border-strong)",
} as const;
