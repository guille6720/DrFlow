import { describe, expect, it } from "vitest";

import { htmlClipboardToFormattedText } from "@/lib/utils/clipboard-html-to-formatted-text";

describe("htmlClipboardToFormattedText", () => {
  it("preserves paragraphs and line breaks", () => {
    const text = htmlClipboardToFormattedText(
      "<p>Primera línea</p><p>Segunda línea</p><br/><div>Tercera</div>"
    );
    expect(text).toContain("Primera línea");
    expect(text).toContain("Segunda línea");
    expect(text).toContain("Tercera");
    expect(text.split("\n").length).toBeGreaterThanOrEqual(3);
  });

  it("preserves lists and bold/italic markers", () => {
    const text = htmlClipboardToFormattedText(
      "<ul><li><b>Uno</b></li><li><i>Dos</i></li></ul>"
    );
    expect(text).toMatch(/•\s*\*\*Uno\*\*/);
    expect(text).toMatch(/•\s*_Dos_/);
  });

  it("does not keep script content", () => {
    const text = htmlClipboardToFormattedText(
      "<p>OK</p><script>alert(1)</script><p>Fin</p>"
    );
    expect(text).toContain("OK");
    expect(text).toContain("Fin");
    expect(text).not.toContain("alert");
  });
});
