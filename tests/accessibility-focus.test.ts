import { describe, expect, it, vi } from "vitest";
import { focusFirstElement, getFocusableElements } from "@/lib/accessibility/focus";

describe("accessibility focus utils", () => {
  it("focusFirstElement focuses first control", () => {
    document.body.innerHTML = `
      <div id="modal">
        <button type="button" id="first">OK</button>
        <button type="button">Cancel</button>
      </div>
    `;
    const modal = document.getElementById("modal")!;
    const first = document.getElementById("first") as HTMLButtonElement;
    const focusSpy = vi.spyOn(first, "focus");
    expect(focusFirstElement(modal)).toBe(true);
    expect(focusSpy).toHaveBeenCalled();
  });

  it("returns false when no focusable elements", () => {
    document.body.innerHTML = `<div id="empty"></div>`;
    expect(focusFirstElement(document.getElementById("empty")!)).toBe(false);
  });

  it("skips aria-hidden elements", () => {
    document.body.innerHTML = `
      <div id="root">
        <button aria-hidden="true">Hidden</button>
        <a href="/x">Visible</a>
      </div>
    `;
    const focusable = getFocusableElements(document.getElementById("root")!);
    expect(focusable).toHaveLength(1);
    expect(focusable[0]?.tagName).toBe("A");
  });
});
