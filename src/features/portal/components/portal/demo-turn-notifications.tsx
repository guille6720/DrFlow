"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  disableDemoTurnNotifications,
  enableDemoTurnNotifications,
} from "@/features/portal/actions/demo-push";

import { Button } from "@/components/ui/button";

async function registerReminderWorker(slug: string) {
  const scope = `/portal/${encodeURIComponent(slug)}`;
  const registration = await navigator.serviceWorker.register("/sw-portal.js", { scope });
  if (registration.active?.state === "activated") return registration;
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw new Error("No se pudo iniciar el servicio de recordatorios.");

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("El servicio todavía se está iniciando.")), 10_000);
    function finish(error?: Error) {
      window.clearTimeout(timeout);
      worker?.removeEventListener("statechange", check);
      if (error) reject(error);
      else resolve();
    }
    function check() {
      if (worker?.state === "activated") finish();
      else if (worker?.state === "redundant") finish(new Error("No se pudo iniciar el servicio de recordatorios."));
    }
    worker.addEventListener("statechange", check);
    check();
  });
  return registration;
}

async function getPreviousSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/portal/");
  if (registration?.scope !== new URL("/portal/", window.location.origin).href) return null;
  return registration.pushManager.getSubscription();
}

export function DemoTurnNotifications({ slug, publicKey }: { slug: string; publicKey: string }) {
  const [enabled, setEnabled] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [supported, setSupported] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const registration = useRef<Promise<ServiceWorkerRegistration> | null>(null);

  useEffect(() => {
    const ready = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    queueMicrotask(() => setSupported(ready));
    if (!ready) return;
    registration.current = registerReminderWorker(slug);
    void registration.current.then(async (worker) => {
      const subscription = await worker.pushManager.getSubscription();
      if (subscription) {
        const result = await enableDemoTurnNotifications(slug, subscription.toJSON());
        setEnabled(Boolean(result.success));
        if (result.success) await (await getPreviousSubscription())?.unsubscribe();
      }
      else if (await getPreviousSubscription()) setNeedsActivation(true);
      if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
    }).catch(() => { registration.current = null; });
  }, [slug]);

  async function toggle() {
    setMessage("");
    setSaving(true);
    try {
      if (enabled) {
        const worker = await (registration.current ?? registerReminderWorker(slug));
        await (await worker.pushManager.getSubscription())?.unsubscribe();
        await (await getPreviousSubscription())?.unsubscribe();
        const result = await disableDemoTurnNotifications(slug);
        setEnabled(false);
        if (result.error) setMessage(result.error);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Permití las notificaciones del portal en los ajustes del celular.");
        return;
      }
      const worker = await (registration.current ?? registerReminderWorker(slug));
      const existing = await worker.pushManager.getSubscription();
      const subscription = existing ?? await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });
      const result = await enableDemoTurnNotifications(slug, subscription.toJSON());
      if (result.error) {
        if (!existing) await subscription.unsubscribe();
        setMessage(result.error);
        return;
      }
      setEnabled(true);
      setNeedsActivation(false);
      await (await getPreviousSubscription())?.unsubscribe();
    } catch {
      setMessage("No pudimos cambiar los recordatorios. Volvé a intentar desde la app instalada.");
    } finally {
      setSaving(false);
    }
  }

  if (!supported) return null;
  return (
    <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Bell aria-hidden="true" className="h-4 w-4 text-emerald-700" />
        {enabled ? "Recordatorios activados" : "Recordatorio el día del turno"}
      </div>
      <Button type="button" size="sm" variant="outline" loading={saving} onClick={toggle}>
        {enabled ? "Desactivar" : needsActivation ? "Volver a activar recordatorios" : "Activar recordatorios"}
      </Button>
      {message && <p role="status" className="w-full text-xs text-slate-700">{message}</p>}
    </section>
  );
}
