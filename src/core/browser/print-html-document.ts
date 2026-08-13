import { runBrowserPrintWithFilename } from "@/core/browser/print-suggested-filename";
import { escapeHtml } from "@/core/security/xss";

export type PrintHtmlDocumentFailureReason =
  | "empty"
  | "popup_blocked"
  | "document_write_failed"
  | "print_unavailable"
  | "unknown";

export type PrintHtmlDocumentResult =
  | { ok: true; method: "iframe" }
  | { ok: false; reason: PrintHtmlDocumentFailureReason; message: string };

export type PrintHtmlDocumentOptions = {
  html: string;
  title?: string;
};

const DOCUMENT_WRITE_FAILED_MESSAGE =
  "No se pudo preparar el documento para imprimir. Intentá de nuevo.";

const PRINT_UNAVAILABLE_MESSAGE =
  "La impresión no está disponible en este dispositivo.";

const UNKNOWN_MESSAGE = "No se pudo imprimir. Intentá de nuevo.";

const PRINT_CLEANUP_FALLBACK_MS = 120_000;

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

function getSharedPrintFrame(): HTMLIFrameElement | null {
  if (typeof document === "undefined") return null;

  if (sharedPrintFrame?.isConnected) {
    return sharedPrintFrame;
  }

  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Impresión");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
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

function restoreOpenerFocus(): void {
  try {
    window.focus();
  } catch {
    /* ignore */
  }
}

function triggerIframePrint(frameWindow: Window, onCleanup: () => void): void {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    restoreOpenerFocus();
    onCleanup();
  };

  const print = () => {
    try {
      frameWindow.print();
    } catch {
      cleanup();
    }
  };

  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, PRINT_CLEANUP_FALLBACK_MS);

  if (frameWindow.document.readyState === "complete") {
    window.setTimeout(print, 150);
  } else {
    frameWindow.addEventListener("load", () => window.setTimeout(print, 150), { once: true });
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

  if (!loadHtmlInFrame(iframe, html)) {
    return fail("document_write_failed", DOCUMENT_WRITE_FAILED_MESSAGE);
  }

  triggerIframePrint(frameWindow, () => {
    try {
      iframe.srcdoc = "";
    } catch {
      /* ignore */
    }
  });

  return { ok: true, method: "iframe" };
}

/**
 * Opens an isolated HTML document and triggers the browser print dialog.
 * Uses a hidden iframe on the current page — never opens a new browser tab.
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
    const run = () => tryPrintViaIframe(html);
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
