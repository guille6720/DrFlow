import { UI_THEME_BOOTSTRAP_SCRIPT } from "@/core/theme/ui-theme";

/** Evita flash al cargar: aplica data-ui-style antes del paint. */
export function UiThemeBootstrapScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: UI_THEME_BOOTSTRAP_SCRIPT }}
      suppressHydrationWarning
    />
  );
}
