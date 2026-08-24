import { runBrowserPrintWithFilename } from "@/core/browser/print-suggested-filename";
import { escapeHtml } from "@/core/security/xss";

export type PrintHtmlDocumentFailureReason =
  | "empty"
  | "popup_blocked"
  | "document_write_failed"
  | "print_unavailable"
  | "unknown";

export type PrintHtmlDocumentResult =
  | { ok: true; method: "popup" | "iframe" }
  | { ok: false; reason: PrintHtmlDocumentFailureReason; message: string };

export type PrintHtmlDocumentOptions = {
  html: string;
  title?: string;
};

const POPUP_BLOCKED_MESSAGE =
  "No pudimos abrir la ventana de impresión. Permití ventanas emergentes e intentá de nuevo.";

const DOCUMENT_WRITE_FAILED_MESSAGE =
  "No se pudo preparar el documento para imprimir. Intentá de nuevo.";

const PRINT_UNAVAILABLE_MESSAGE =
  "La impresión no está disponible en este dispositivo.";

const UNKNOWN_MESSAGE = "No se pudo imprimir. Intentá de nuevo.";

const PRINT_CLEANUP_FALLBACK_MS = 120_000;

/** A4 at 96dpi — zero-size iframes clip multi-page prints in Chrome/Edge. */
const PRINT_FRAME_WIDTH_PX = "794px";
const PRINT_FRAME_HEIGHT_PX = "1123px";

let sharedPrintFrame: HTMLIFrameElement | null = null;

function fail(
  reason: PrintHtmlDocumentFailureReason,
  message: string
): PrintHtmlDocumentResult {
  return { ok: false, reason, message };
}

function applyHtmlDocumentTitle(html: string, title: string): string {
  const tag = `<title>${escapeHtml(title)}</title>`;
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, tag);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${tag}`);
  }
  return html;
}

function writeHtmlDocument(targetDoc: Document, html: string): boolean {
  try {
    targetDoc.open();
    targetDoc.write(html);
    targetDoc.close();
    return true;
  } catch {
    return false;
  }
}

function closePrintWindow(targetWindow: Window): void {
  try {
    if (!targetWindow.closed) {
      targetWindow.close();
    }
  } catch {
    /* cross-origin or already closed */
  }
}

function restoreOpenerFocus(): void {
  try {
    window.focus();
  } catch {
    /* ignore */
  }
}

function triggerPrintWithCleanup(targetWindow: Window, onCleanup: () => void): void {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    restoreOpenerFocus();
    onCleanup();
  };

  const print = () => {
    try {
      targetWindow.print();
    } catch {
      cleanup();
    }
  };

  targetWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, PRINT_CLEANUP_FALLBACK_MS);

  if (targetWindow.document.readyState === "complete") {
    window.setTimeout(print, 150);
  } else {
    targetWindow.addEventListener("load", () => window.setTimeout(print, 150), { once: true });
  }
}

function tryPrintViaPopup(html: string): PrintHtmlDocumentResult {
  let printWindow: Window | null = null;
  try {
    // Do not use noopener/noreferrer: Chrome opens about:blank but returns null,
    // leaving an empty tab and blocking document.write + print().
    printWindow = window.open("about:blank", "_blank");
  } catch {
    return fail("popup_blocked", POPUP_BLOCKED_MESSAGE);
  }

  if (!printWindow || printWindow.closed) {
    return fail("popup_blocked", POPUP_BLOCKED_MESSAGE);
  }

  if (!writeHtmlDocument(printWindow.document, html)) {
    closePrintWindow(printWindow);
    return fail("document_write_failed", DOCUMENT_WRITE_FAILED_MESSAGE);
  }

  triggerPrintWithCleanup(printWindow, () => closePrintWindow(printWindow!));
  return { ok: true, method: "popup" };
}

function getSharedPrintFrame(): HTMLIFrameElement | null {
  if (typeof document === "undefined") return null;

  if (sharedPrintFrame?.isConnected) {
    return sharedPrintFrame;
  }

  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Impresión");
    iframe.tabIndex = -1;
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = PRINT_FRAME_WIDTH_PX;
    iframe.style.height = PRINT_FRAME_HEIGHT_PX;
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.visibility = "hidden";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);
    sharedPrintFrame = iframe;
    return iframe;
  } catch {
    return null;
  }
}

function loadHtmlInFrame(iframe: HTMLIFrameElement, html: string): boolean {
  try {
    iframe.srcdoc = html;
    return true;
  } catch {
    const frameDoc = iframe.contentDocument;
    if (!frameDoc) return false;
    return writeHtmlDocument(frameDoc, html);
  }
}

function tryPrintViaIframe(html: string): PrintHtmlDocumentResult {
  const iframe = getSharedPrintFrame();
  if (!iframe) {
    return fail("print_unavailable", PRINT_UNAVAILABLE_MESSAGE);
  }

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    return fail("print_unavailable", PRINT_UNAVAILABLE_MESSAGE);
  }

  let started = false;
  const startPrint = () => {
    if (started) return;
    started = true;
    triggerPrintWithCleanup(frameWindow, () => {
      try {
        iframe.srcdoc = "";
      } catch {
        /* ignore */
      }
    });
  };

  iframe.addEventListener("load", () => window.setTimeout(startPrint, 50), { once: true });

  if (!loadHtmlInFrame(iframe, html)) {
    return fail("document_write_failed", DOCUMENT_WRITE_FAILED_MESSAGE);
  }

  // Fallback if this engine does not fire load for an identical/empty-to-content srcdoc swap.
  window.setTimeout(startPrint, 400);

  return { ok: true, method: "iframe" };
}

/**
 * Triggers the browser print dialog for an isolated HTML document.
 * Prefers a hidden off-screen A4 iframe so no extra tab/page opens; popup is fallback only.
 */
export function printHtmlDocument(options: PrintHtmlDocumentOptions): PrintHtmlDocumentResult {
  const printTitle = options.title?.replace(/\.pdf$/i, "").trim();
  const html = printTitle ? applyHtmlDocumentTitle(options.html, printTitle) : options.html;
  if (!html.trim()) {
    return fail("empty", "No hay contenido para imprimir.");
  }

  if (typeof window === "undefined") {
    return fail("print_unavailable", PRINT_UNAVAILABLE_MESSAGE);
  }

  try {
    const run = (): PrintHtmlDocumentResult => {
      const strategies: Array<() => PrintHtmlDocumentResult> = [
        () => tryPrintViaIframe(html),
        () => tryPrintViaPopup(html),
      ];

      let lastFailure: PrintHtmlDocumentResult = fail("unknown", UNKNOWN_MESSAGE);
      for (const strategy of strategies) {
        const result = strategy();
        if (result.ok) return result;
        lastFailure = result;
      }
      return lastFailure;
    };

    if (printTitle) {
      let result: PrintHtmlDocumentResult = fail("unknown", UNKNOWN_MESSAGE);
      runBrowserPrintWithFilename(printTitle, () => {
        result = run();
      });
      return result;
    }
    return run();
  } catch {
    return fail("unknown", UNKNOWN_MESSAGE);
  }
}
