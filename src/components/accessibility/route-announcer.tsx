"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const title = document.title?.trim();
    setAnnouncement(title || pathname);
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
