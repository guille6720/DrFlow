"use client";

import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { MANUAL_SECTIONS, MANUAL_SUBTITLE, MANUAL_TITLE } from "@/core/manual/manual-data";
import { CHANGELOG, getAppVersion } from "@/core/app-release";
import { Download } from "lucide-react";

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 5
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function ExportManualPdfButton() {
  function exportPdf() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 16;
    const maxW = pageW - margin * 2;
    let y = margin;

    function ensureSpace(need: number) {
      if (y + need > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(MANUAL_TITLE, margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    y = addWrappedText(doc, MANUAL_SUBTITLE, margin, y, maxW, 5);
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Versión ${getAppVersion()} · Generado ${new Date().toLocaleString("es-AR")}`, margin, y);
    doc.setTextColor(0);
    y += 10;

    // Changelog
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Novedades recientes", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const entry of CHANGELOG.slice(0, 3)) {
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.text(`${entry.version} — ${entry.title} (${entry.date})`, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      for (const h of entry.highlights) {
        ensureSpace(8);
        y = addWrappedText(doc, `• ${h}`, margin + 2, y, maxW - 2, 4.5);
        y += 1;
      }
      y += 3;
    }

    for (const section of MANUAL_SECTIONS) {
      ensureSpace(28);
      doc.setDrawColor(37, 99, 235);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(margin, y - 4, maxW, 10, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 64, 175);
      doc.text(section.title, margin + 3, y + 3);
      doc.setTextColor(0);
      y += 12;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      y = addWrappedText(doc, section.summary, margin, y, maxW, 4.5);
      y += 4;

      // Mini "illustration" as numbered flow boxes
      ensureSpace(14);
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Flujo: ${section.illustration}`, margin, y);
      doc.setTextColor(0);
      y += 5;
      const labels = section.steps.slice(0, 4).map((s, i) => `${i + 1}. ${s.title}`);
      let x = margin;
      for (const label of labels) {
        const boxW = Math.min(42, (maxW - 4) / labels.length);
        ensureSpace(12);
        doc.setDrawColor(148, 163, 184);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, boxW - 2, 10, 1, 1, "FD");
        const short = doc.splitTextToSize(label, boxW - 4) as string[];
        doc.setFontSize(7);
        doc.text(short.slice(0, 2), x + 1.5, y + 4);
        x += boxW;
      }
      y += 14;

      section.steps.forEach((step, idx) => {
        ensureSpace(16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${idx + 1}. ${step.title}`, margin, y);
        y += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        y = addWrappedText(doc, step.body, margin + 2, y, maxW - 2, 4.2);
        y += 3;
      });

      if (section.tips?.length) {
        ensureSpace(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9);
        doc.text("Tips", margin, y);
        doc.setTextColor(0);
        y += 4;
        doc.setFont("helvetica", "normal");
        for (const tip of section.tips) {
          ensureSpace(8);
          y = addWrappedText(doc, `• ${tip}`, margin + 2, y, maxW - 2, 4);
          y += 1;
        }
      }
      y += 6;
    }

    ensureSpace(20);
    doc.setFontSize(8);
    doc.setTextColor(100);
    y = addWrappedText(
      doc,
      "Este PDF se regenera desde el manual vivo de DrFlow. Ante una actualización de la app, descargá de nuevo desde Ayuda para tener la última versión.",
      margin,
      y,
      maxW,
      4
    );

    doc.save(`DrFlow-Manual-medico-v${getAppVersion()}.pdf`);
  }

  return (
    <Button type="button" onClick={exportPdf} className="gap-2">
      <Download className="h-4 w-4" />
      Descargar manual PDF
    </Button>
  );
}
