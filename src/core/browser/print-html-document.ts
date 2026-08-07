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
const IFRAME_CLEANUP_FALLBACK_MS = 5_000;

function fail(
  reason: PrintHtmlDocumentFailureReason,
  message: string
): PrintHtmlDocumentResult {
  return { ok: false, reason, message };
}

function isMobilePrintContext(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
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
    /* already closed */
  }
}

function triggerPrintWithCleanup(targetWindow: Window, onCleanup: () => void): void {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    onCleanup();
  };

  const print = () => {
    try {
      targetWindow.focus();
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
  if (typeof window === "undefined") {
    return fail("print_unavailable", PRINT_UNAVAILABLE_MESSAGE);
  }

  let printWindow: Window | null = null;
  try {
    printWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
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

function tryPrintViaIframe(html: string): PrintHtmlDocumentResult {
  if (typeof document === "undefined") {
    return fail("print_unavailable", PRINT_UNAVAILABLE_MESSAGE);
  }

  let iframe: HTMLIFrameElement;
  try {
    iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "Impresión");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
  } catch {
    return fail("print_unavailable", PRINT_UNAVAILABLE_MESSAGE);
  }

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    return fail("print_unavailable", PRINT_UNAVAILABLE_MESSAGE);
  }

  if (!writeHtmlDocument(frameDoc, html)) {
    iframe.remove();
    return fail("document_write_failed", DOCUMENT_WRITE_FAILED_MESSAGE);
  }

  const removeIframe = () => {
    if (iframe.isConnected) {
      iframe.remove();
    }
  };

  triggerPrintWithCleanup(frameWindow, removeIframe);
  window.setTimeout(removeIframe, IFRAME_CLEANUP_FALLBACK_MS);

  return { ok: true, method: "iframe" };
}

/** Opens an isolated HTML document and triggers the browser print dialog. */
export function printHtmlDocument(options: PrintHtmlDocumentOptions): PrintHtmlDocumentResult {
  const html = options.html;
  if (!html.trim()) {
    return fail("empty", "No hay contenido para imprimir.");
  }

  try {
    const strategies: Array<() => PrintHtmlDocumentResult> = isMobilePrintContext()
      ? [() => tryPrintViaIframe(html), () => tryPrintViaPopup(html)]
      : [() => tryPrintViaPopup(html), () => tryPrintViaIframe(html)];

    let lastFailure: PrintHtmlDocumentResult = fail("unknown", UNKNOWN_MESSAGE);

    for (const strategy of strategies) {
      const result = strategy();
      if (result.ok) return result;
      lastFailure = result;
    }

    return lastFailure;
  } catch {
    return fail("unknown", UNKNOWN_MESSAGE);
  }
}
