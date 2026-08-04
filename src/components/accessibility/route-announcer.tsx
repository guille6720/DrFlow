"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const title = document.title?.trim();
    const next = title || pathname;
    const frame = requestAnimationFrame(() => setAnnouncement(next));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
