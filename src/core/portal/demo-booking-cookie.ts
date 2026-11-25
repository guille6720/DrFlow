import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { buildPortalCookieOptions } from "@/core/portal/patient-portal-cookie";

const PREFIX = "drflow_lamejor_turno_";
const ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const MAX_BOOKINGS = 20;

function signBookingId(appointmentId: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`nexclinic/fiscalization/lamejor/booking/${appointmentId}`)
    .digest();
}

export async function rememberDemoBooking(appointmentId: string, expiresAt: Date) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !ID_PATTERN.test(appointmentId)) return;

  const jar = await cookies();
  const name = `${PREFIX}${appointmentId}`;
  const options = { ...buildPortalCookieOptions(expiresAt), path: "/portal/nexclinic-demo-medica-15d" };
  const otherBookings = jar.getAll().filter((entry) => entry.name.startsWith(PREFIX) && entry.name !== name);
  for (const entry of otherBookings.slice(0, Math.max(0, otherBookings.length - MAX_BOOKINGS + 1))) {
    jar.set(entry.name, "", { ...options, expires: new Date(0) });
  }
  jar.set(name, signBookingId(appointmentId, secret).toString("hex"), options);
}

export async function readDemoBookingIds(): Promise<string[]> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return [];

  const jar = await cookies();
  return jar.getAll()
    .filter((entry) => entry.name.startsWith(PREFIX))
    .slice(-MAX_BOOKINGS)
    .flatMap(({ name, value }) => {
      const id = name.slice(PREFIX.length);
      if (!ID_PATTERN.test(id) || !/^[0-9a-f]{64}$/.test(value)) return [];
      return timingSafeEqual(signBookingId(id, secret), Buffer.from(value, "hex")) ? [id] : [];
    });
}
