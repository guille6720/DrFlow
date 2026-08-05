/** Lazy-load jsPDF (~350KB gzip) only when the user exports a PDF. */
export async function loadJsPdf() {
  const mod = await import("jspdf");
  return mod.default;
}

export type JsPdfDocument = InstanceType<Awaited<ReturnType<typeof loadJsPdf>>>;
