"use client";

import { RefreshCw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { logClientError } from "@/core/errors";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "drflow_seen_release";

type ReleaseInfo = {
  version: string;
  buildId: string;
  title: string;
  highlights: string[];
};

type StoredRelease = {
  version: string;
  buildId: string;
};

function readStored(): StoredRelease | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRelease;
    if (parsed?.version && parsed?.buildId) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeStored(release: StoredRelease) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(release));
}

/**
 * Aviso cuando hay una nueva versión (navegador o PWA instalada).
 * Compara /api/version con la versión guardada en este dispositivo.
 */
export function UpdateBanner() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [visible, setVisible] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) return;

      const data = (await res.json()) as ReleaseInfo;
      const stored = readStored();

      if (!stored) {
        writeStored({ version: data.version, buildId: data.buildId });
        return;
      }

      const changed =
        stored.buildId !== data.buildId || stored.version !== data.version;

      if (changed) {
        setRelease(data);
        setVisible(true);
      }
    } catch {
      /* offline / sin red */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void check());
    const onFocus = () => void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void check(), 5 * 60 * 1000);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        void check();
      });
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.addEventListener("updatefound", () => {
          void check();
        });
      }).catch((err) => logClientError("update-banner.service-worker", err));
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [check]);

  function dismiss() {
    if (release) writeStored({ version: release.version, buildId: release.buildId });
    setVisible(false);
  }

  function reloadApp() {
    if (release) writeStored({ version: release.version, buildId: release.buildId });
    window.location.reload();
  }

  if (!visible || !release) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-md sm:p-0 lg:bottom-6"
    >
      <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-xl shadow-blue-900/15">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Nueva versión DrFlow {release.version}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">{release.title}</p>
            {release.highlights[0] && (
              <p className="mt-2 text-xs text-slate-500">{release.highlights[0]}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={reloadApp}>
                <RefreshCw className="h-3.5 w-3.5" />
                Actualizar ahora
              </Button>
              <Link
                href="/ayuda"
                onClick={dismiss}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-50"
              >
                Ver manual
              </Link>
              <button
                type="button"
                onClick={dismiss}
                className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
