export type CopyToClipboardFailureReason =
  | "empty"
  | "insecure_context"
  | "not_available"
  | "permission_denied"
  | "fallback_failed"
  | "unknown";

export type CopyToClipboardResult =
  | { ok: true; method: "clipboard-api" | "exec-command" }
  | { ok: false; reason: CopyToClipboardFailureReason; message: string };

const PERMISSION_DENIED_MESSAGE =
  "No pudimos copiar: el navegador bloqueó el acceso al portapapeles. Permití el permiso o copiá manualmente desde la vista previa.";

const INSECURE_CONTEXT_MESSAGE =
  "Copiar no está disponible en este contexto. Usá HTTPS o seleccioná el texto de la vista previa y presioná Ctrl+C.";

const NOT_AVAILABLE_MESSAGE =
  "Tu navegador no permite copiar automáticamente. Seleccioná el texto de la vista previa y usá Ctrl+C.";

const UNKNOWN_MESSAGE =
  "No se pudo copiar al portapapeles. Intentá de nuevo o copiá manualmente desde la vista previa.";

function isSecureClipboardContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

function hasClipboardWriteApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  );
}

function isClipboardPermissionError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "NotAllowedError" || error.name === "SecurityError";
  }
  return false;
}

/** Legacy fallback — requires a user gesture (e.g. button click). */
export function copyTextWithExecCommand(text: string): boolean {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

function fail(
  reason: CopyToClipboardFailureReason,
  message: string
): CopyToClipboardResult {
  return { ok: false, reason, message };
}

/**
 * Copies text to the system clipboard using the Clipboard API when possible,
 * with an execCommand fallback for older browsers or blocked permissions.
 */
export async function copyTextToClipboard(text: string): Promise<CopyToClipboardResult> {
  if (!text) {
    return fail("empty", "No hay texto para copiar.");
  }

  if (hasClipboardWriteApi() && isSecureClipboardContext()) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard-api" };
    } catch (error) {
      const fallbackCopied = copyTextWithExecCommand(text);
      if (fallbackCopied) {
        return { ok: true, method: "exec-command" };
      }
      if (isClipboardPermissionError(error)) {
        return fail("permission_denied", PERMISSION_DENIED_MESSAGE);
      }
      return fail("unknown", UNKNOWN_MESSAGE);
    }
  }

  const fallbackCopied = copyTextWithExecCommand(text);
  if (fallbackCopied) {
    return { ok: true, method: "exec-command" };
  }

  if (!isSecureClipboardContext()) {
    return fail("insecure_context", INSECURE_CONTEXT_MESSAGE);
  }

  if (!hasClipboardWriteApi()) {
    return fail("not_available", NOT_AVAILABLE_MESSAGE);
  }

  return fail("fallback_failed", UNKNOWN_MESSAGE);
}

export function getCopyToClipboardErrorMessage(reason: CopyToClipboardFailureReason): string {
  switch (reason) {
    case "empty":
      return "No hay texto para copiar.";
    case "permission_denied":
      return PERMISSION_DENIED_MESSAGE;
    case "insecure_context":
      return INSECURE_CONTEXT_MESSAGE;
    case "not_available":
      return NOT_AVAILABLE_MESSAGE;
    case "fallback_failed":
    case "unknown":
    default:
      return UNKNOWN_MESSAGE;
  }
}
