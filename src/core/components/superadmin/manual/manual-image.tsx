"use client";

import { useState } from "react";

import type { ManualImageRef } from "@/core/components/superadmin/manual/manual-data";

/**
 * Manual illustrations are local SVGs under /public.
 * next/image's default optimizer rejects SVG, which shows a broken image in production/preview.
 */
export function ManualImage({ image }: { image: ManualImageRef }) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <figure className="space-y-2">
      <button
        type="button"
        onClick={() => setZoomed((z) => !z)}
        className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-left shadow-sm outline-none ring-teal-500 focus-visible:ring-2 dark:border-slate-700"
        aria-label={zoomed ? "Reducir imagen" : "Ampliar imagen"}
      >
        {/* Local static SVG — intentionally not next/image */}
        <img
          src={image.src}
          alt={image.alt}
          width={960}
          height={420}
          decoding="async"
          className={`h-auto w-full object-contain transition-transform ${zoomed ? "scale-110" : "scale-100"}`}
        />
      </button>
      {image.caption ? (
        <figcaption className="text-xs text-slate-500 dark:text-slate-400">{image.caption}</figcaption>
      ) : null}
    </figure>
  );
}
