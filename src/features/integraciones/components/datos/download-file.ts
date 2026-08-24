"use client";

import { EXPORT_CACHE_CONTROL_NO_STORE } from "@/core/compliance/data-export-security";

export function downloadBase64File(fileName: string, mime: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(fileName: string, mime: string, contents: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.click();
  URL.revokeObjectURL(url);
}

/** Fetch a short-lived signed export URL without browser HTTP cache. */
export async function downloadFromUrl(fileName: string, url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "omit",
    headers: {
      "Cache-Control": EXPORT_CACHE_CONTROL_NO_STORE,
      Pragma: "no-cache",
    },
  });
  if (!response.ok) throw new Error("No se pudo descargar el archivo.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.click();
  URL.revokeObjectURL(objectUrl);
}
