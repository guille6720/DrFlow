"use client";

import { useState } from "react";

import type { ManualImageRef } from "@/core/components/superadmin/manual/manual-data";
import { MANUAL_ILLUSTRATION_MARKUP } from "@/core/components/superadmin/manual/manual-illustration-markup";

/** Renders inlined SVG markup so illustrations never depend on static asset CSP or external image fetches. */
export function ManualImage({ image }: { image: ManualImageRef }) {
  const [zoomed, setZoomed] = useState(false);
  const markup = MANUAL_ILLUSTRATION_MARKUP[image.illustrationId];

  return (
    <figure className="space-y-2">
      <button
        type="button"
        onClick={() => setZoomed((z) => !z)}
        className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-left shadow-sm outline-none ring-teal-500 focus-visible:ring-2 dark:border-slate-700"
        aria-label={zoomed ? "Reducir imagen" : "Ampliar imagen"}
      >
        <div
          role="img"
          aria-label={image.alt}
          className={`w-full origin-center transition-transform [&_svg]:h-auto [&_svg]:w-full ${
            zoomed ? "scale-110" : "scale-100"
          }`}
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      </button>
      {image.caption ? (
        <figcaption className="text-xs text-slate-500 dark:text-slate-400">{image.caption}</figcaption>
      ) : null}
    </figure>
  );
}
