/** Fuerza tema claro en páginas de marketing (evita bleed del modo oscuro clínico). */
export function MarketingThemeScript() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `(function(){try{document.documentElement.setAttribute("data-ui-style","2");document.documentElement.removeAttribute("data-ui-palette");document.documentElement.removeAttribute("data-clinical-dark");document.body.style.backgroundColor="#f8fafc";document.body.style.color="#0f172a";}catch(e){}})();`,
      }}
    />
  );
}
