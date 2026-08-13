const PRINT_TITLE_RESTORE_MS = 120_000;
/** Keep the suggested name while Chrome/Edge shows the Save-as dialog after afterprint. */
const PRINT_TITLE_RESTORE_AFTER_PRINT_MS = 30_000;

/**
 * Chrome/Edge "Save as PDF" uses the top-level `document.title` as the default filename.
 * Set it around print and restore afterwards.
 */
export function runBrowserPrintWithFilename(title: string, print: () => void): void {
  if (typeof document === "undefined") {
    print();
    return;
  }

  const previous = document.title;
  const suggested = title.replace(/\.pdf$/i, "").trim() || previous;
  document.title = suggested;

  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.title = previous;
  };

  window.addEventListener(
    "afterprint",
    () => {
      window.setTimeout(restore, PRINT_TITLE_RESTORE_AFTER_PRINT_MS);
    },
    { once: true }
  );
  window.setTimeout(restore, PRINT_TITLE_RESTORE_MS);
  print();
}
