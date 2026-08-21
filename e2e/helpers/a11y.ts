import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export type ContrastSampleViolation = {
  tag: string;
  text: string;
  fg: string;
  bg: string;
  ratio: number;
  fontSize: number;
  fontWeight: number;
};

/**
 * axe-core color-contrast + common serious issues on the current page.
 * Excludes known noisy rules that are unrelated to theme readability.
 */
export async function expectNoSeriousAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .disableRules([
      // Marketing/public pages often have landmark noise; focus on contrast/readability
      "region",
      "landmark-one-main",
      "landmark-unique",
      "page-has-heading-one",
    ])
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  expect(
    serious,
    [
      `axe serious/critical on ${label}`,
      ...serious.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join(" | ")}`
      ),
    ].join("\n")
  ).toEqual([]);
}

/**
 * Runtime sample of visible text vs nearest opaque background.
 * Practical detector for washed text that token unit tests cannot see.
 */
export async function sampleVisibleTextContrast(
  page: Page,
  options?: { limit?: number; minRatio?: number }
): Promise<ContrastSampleViolation[]> {
  const limit = options?.limit ?? 80;
  const minRatio = options?.minRatio ?? 4.5;

  return page.evaluate(
    ({ limit: maxNodes, floor }) => {
      function parseRgb(input: string): [number, number, number, number] | null {
        const m = input.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
        if (!m) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
      }

      function channel(c: number): number {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      }

      function luminance(rgb: [number, number, number]): number {
        return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
      }

      function contrast(fg: [number, number, number], bg: [number, number, number]): number {
        const L1 = luminance(fg);
        const L2 = luminance(bg);
        const lighter = Math.max(L1, L2);
        const darker = Math.min(L1, L2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function blend(
        fg: [number, number, number, number],
        bg: [number, number, number]
      ): [number, number, number] {
        const a = fg[3];
        return [
          fg[0] * a + bg[0] * (1 - a),
          fg[1] * a + bg[1] * (1 - a),
          fg[2] * a + bg[2] * (1 - a),
        ];
      }

      function opaqueBackground(el: Element): [number, number, number] {
        let node: Element | null = el;
        let acc: [number, number, number] = [255, 255, 255];
        const stack: Array<[number, number, number, number]> = [];
        while (node && node !== document.documentElement) {
          const bg = parseRgb(getComputedStyle(node).backgroundColor);
          if (bg && bg[3] > 0.01) stack.push(bg);
          if (bg && bg[3] >= 0.99) break;
          node = node.parentElement;
        }
        const rootBg = parseRgb(getComputedStyle(document.documentElement).backgroundColor);
        if (rootBg) acc = [rootBg[0], rootBg[1], rootBg[2]];
        for (let i = stack.length - 1; i >= 0; i -= 1) {
          acc = blend(stack[i]!, acc);
        }
        return acc;
      }

      function isVisible(el: HTMLElement): boolean {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      const selectors = [
        "h1",
        "h2",
        "h3",
        "label",
        "button",
        "a",
        "p",
        "span",
        "td",
        "th",
        "li",
        "[role='dialog'] h2",
        "[role='dialog'] p",
        ".drflow-ui-label",
        ".drflow-ui-button",
      ];

      const seen = new Set<Element>();
      const candidates: HTMLElement[] = [];
      for (const sel of selectors) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          if (seen.has(el)) continue;
          seen.add(el);
          if (!(el instanceof HTMLElement)) continue;
          if (!isVisible(el)) continue;
          const text = (el.innerText || el.textContent || "").trim();
          if (text.length < 2 || text.length > 120) continue;
          candidates.push(el);
          if (candidates.length >= maxNodes) break;
        }
        if (candidates.length >= maxNodes) break;
      }

      const violations: Array<{
        tag: string;
        text: string;
        fg: string;
        bg: string;
        ratio: number;
        fontSize: number;
        fontWeight: number;
      }> = [];

      for (const el of candidates) {
        const style = getComputedStyle(el);
        const fgParsed = parseRgb(style.color);
        if (!fgParsed) continue;
        const bg = opaqueBackground(el);
        const fg = blend(fgParsed, bg);
        const ratio = contrast(fg, bg);
        const fontSize = Number.parseFloat(style.fontSize) || 14;
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
        const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const need = large ? 3 : floor;
        if (ratio + 0.05 < need) {
          violations.push({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || "").trim().slice(0, 60),
            fg: style.color,
            bg: `rgb(${bg.map((n) => Math.round(n)).join(", ")})`,
            ratio: Number(ratio.toFixed(2)),
            fontSize,
            fontWeight,
          });
        }
      }

      return violations.slice(0, 12);
    },
    { limit, minRatio }
  );
}

export async function expectReadableSampledContrast(page: Page, label: string): Promise<void> {
  // Floor 3:1 catches washed/invisible text; axe enforces WCAG AA 4.5 on applicable nodes.
  const violations = await sampleVisibleTextContrast(page, { minRatio: 3 });
  expect(
    violations,
    [
      `Contrast sample failures on ${label}`,
      ...violations.map(
        (v) => `${v.tag} "${v.text}" ${v.fg} on ${v.bg} → ${v.ratio}:1`
      ),
    ].join("\n")
  ).toEqual([]);
}
