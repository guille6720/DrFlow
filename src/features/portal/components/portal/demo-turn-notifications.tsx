"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import {
  disableDemoTurnNotifications,
  enableDemoTurnNotifications,
} from "@/features/portal/actions/demo-push";

import { Button } from "@/components/ui/button";

export function DemoTurnNotifications({ slug, publicKey }: { slug: string; publicKey: string }) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ready = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    queueMicrotask(() => setSupported(ready));
    if (!ready) return;
    void navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const result = await enableDemoTurnNotifications(slug, subscription.toJSON());
        setEnabled(Boolean(result.success));
      }
      if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
    }).catch(() => {});
  }, [slug]);

  async function toggle() {
    setMessage("");
    setSaving(true);
    try {
      if (enabled) {
        const registration = await navigator.serviceWorker.ready;
        await (await registration.pushManager.getSubscription())?.unsubscribe();
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
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
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
        {enabled ? "Desactivar" : "Activar recordatorios"}
      </Button>
      {message && <p role="status" className="w-full text-xs text-slate-700">{message}</p>}
    </section>
  );
}
