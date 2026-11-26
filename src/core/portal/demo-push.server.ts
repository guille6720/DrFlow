import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { readDemoBookingIds } from "@/core/portal/demo-booking-cookie";
import { buildPortalCookieOptions } from "@/core/portal/patient-portal-cookie";
import { createAdminClient } from "@/core/supabase/admin";

const DEVICE_COOKIE = "nexclinic_lamejor_push";
export const DEMO_PORTAL_PATH = "/portal/nexclinic-demo-medica-15d";

// Keep the sender restricted to push providers. An endpoint comes from an untrusted client.
const PUSH_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
export const demoSubscriptionSchema = z.object({
  endpoint: z.string().max(2048).url().refine((value) => {
    const url = URL.parse(value);
    return url && url.protocol === "https:" && !url.port && !url.username && !url.password &&
      !url.hash && PUSH_HOSTS.has(url.hostname);
  }),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  }),
});

export async function rememberDemoPushDevice(raw: unknown, expiresAt: Date) {
  const input = demoSubscriptionSchema.safeParse(raw);
  if (!input.success) return false;

  const subscription = input.data;
  const id = createHash("sha256").update(subscription.endpoint).update("\0").update(subscription.keys.auth).digest("hex");
  const appointmentIds = await readDemoBookingIds();
  const jar = await cookies();
  const previous = jar.get(DEVICE_COOKIE)?.value;
  const replacing = previous && previous !== id && /^[a-f0-9]{64}$/.test(previous);
  const db = createAdminClient();
  const existing = replacing
    ? await db.from("lamejor_demo_push_devices").select("last_day").eq("device_id", previous).maybeSingle()
    : null;
  if (existing?.error) return false;
  const { error } = await db.from("lamejor_demo_push_devices").upsert({
    device_id: id,
    subscription,
    appointment_ids: appointmentIds,
    ...(existing?.data?.last_day ? { last_day: existing.data.last_day } : {}),
  });
  if (error) return false;

  if (replacing) {
    await db.from("lamejor_demo_push_devices").delete().eq("device_id", previous);
  }
  jar.set(DEVICE_COOKIE, id, { ...buildPortalCookieOptions(expiresAt), path: DEMO_PORTAL_PATH });
  return true;
}

export async function syncDemoPushAppointments(appointmentId: string) {
  const id = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return;
  const appointmentIds = await readDemoBookingIds();
  await createAdminClient().from("lamejor_demo_push_devices")
    .update({ appointment_ids: [...new Set([appointmentId, ...appointmentIds])].slice(0, 20) })
    .eq("device_id", id);
}

export async function forgetDemoPushDevice() {
  const jar = await cookies();
  const id = jar.get(DEVICE_COOKIE)?.value;
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return true;
  const { error } = await createAdminClient().from("lamejor_demo_push_devices").delete().eq("device_id", id);
  if (error) return false;
  jar.set(DEVICE_COOKIE, "", { ...buildPortalCookieOptions(new Date(0)), path: DEMO_PORTAL_PATH });
  return true;
}
