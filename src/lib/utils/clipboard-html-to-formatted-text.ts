/**
 * Convert clipboard HTML (Word / Docs / browsers) into plain text that keeps
 * structural formatting: paragraphs, lists, tabs, and light markdown markers.
 */

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function collapseWhitespace(text: string): string {
  return text.replace(/[ \t\f\v]+/g, " ");
}

function walk(node: Node, out: string[], listDepth = 0, listIndex = { n: 0 }): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = collapseWhitespace(node.textContent ?? "");
    if (text) out.push(text);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "script" || tag === "style" || tag === "meta" || tag === "link") return;

  if (tag === "br") {
    out.push("\n");
    return;
  }

  const block =
    tag === "p" ||
    tag === "div" ||
    tag === "section" ||
    tag === "article" ||
    tag === "tr" ||
    /^h[1-6]$/.test(tag);

  if (tag === "li") {
    const parent = el.parentElement?.tagName.toLowerCase();
    const ordered = parent === "ol";
    if (ordered) listIndex.n += 1;
    out.push(ordered ? `${listIndex.n}. ` : `${"  ".repeat(listDepth)}• `);
  }

  if (tag === "ul" || tag === "ol") {
    if (out.length && !out[out.length - 1]?.endsWith("\n")) out.push("\n");
    const childIndex = { n: 0 };
    for (const child of Array.from(el.childNodes)) {
      walk(child, out, listDepth + 1, childIndex);
    }
    if (!out[out.length - 1]?.endsWith("\n")) out.push("\n");
    return;
  }

  const wrapBold = tag === "b" || tag === "strong";
  const wrapItalic = tag === "i" || tag === "em";
  if (wrapBold) out.push("**");
  if (wrapItalic) out.push("_");

  if (tag === "td" || tag === "th") {
    if (out.length && !/\s$/.test(out[out.length - 1] ?? "")) out.push("\t");
  }

  for (const child of Array.from(el.childNodes)) {
    walk(child, out, listDepth, listIndex);
  }

  if (wrapItalic) out.push("_");
  if (wrapBold) out.push("**");

  if (tag === "li") {
    if (!out[out.length - 1]?.endsWith("\n")) out.push("\n");
    return;
  }

  if (block) {
    if (!out[out.length - 1]?.endsWith("\n")) out.push("\n");
  }
}

/** HTML fragment → structured plain text (safe for clinical textarea fields). */
export function htmlClipboardToFormattedText(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  if (typeof DOMParser === "undefined") {
    return decodeEntities(trimmed.replace(/<[^>]+>/g, " "));
  }

  const doc = new DOMParser().parseFromString(trimmed, "text/html");
  const out: string[] = [];
  walk(doc.body, out);

  return decodeEntities(out.join(""))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Prefer HTML clipboard data when present so Word/Docs structure survives;
 * fall back to plain text.
 */
export function clipboardEventToFormattedText(event: {
  clipboardData?: DataTransfer | null;
}): string | null {
  const data = event.clipboardData;
  if (!data) return null;

  const html = data.getData("text/html")?.trim();
  if (html) {
    const formatted = htmlClipboardToFormattedText(html);
    if (formatted) return formatted;
  }

  const plain = data.getData("text/plain");
  return plain.length > 0 ? plain.replace(/\r\n/g, "\n") : null;
}
