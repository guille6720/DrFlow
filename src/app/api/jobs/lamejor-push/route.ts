import { timingSafeEqual } from "node:crypto";

import { sendNotification } from "web-push";

import { isFiscalization } from "@/core/environment/runtime";
import { DEMO_PORTAL_PATH, demoSubscriptionSchema } from "@/core/portal/demo-push.server";
import { createAdminClient } from "@/core/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isFiscalization()) return Response.json({ error: "Not found" }, { status: 404 });

  const secret = process.env.LAMEJOR_PUSH_CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const publicKey = process.env.LAMEJOR_PUSH_PUBLIC_KEY;
  const privateKey = process.env.LAMEJOR_PUSH_PRIVATE_KEY;
  if (!publicKey || !privateKey) return Response.json({ error: "Unavailable" }, { status: 503 });

  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_lamejor_demo_push_reminders");
  if (error) return Response.json({ error: "Unavailable" }, { status: 503 });

  let delivered = 0;
  let failed = 0;
  for (let index = 0; index < data.length; index += 10) {
    await Promise.all(data.slice(index, index + 10).map(async (row) => {
      const parsed = demoSubscriptionSchema.safeParse(row.subscription);
      if (!parsed.success) {
        await db.from("lamejor_demo_push_devices").delete().eq("device_id", row.device_id);
        return;
      }
      try {
        await sendNotification(parsed.data, JSON.stringify({
          kind: "lamejor-turno-hoy",
          count: row.appointment_count,
          day: row.day_key,
          path: DEMO_PORTAL_PATH,
        }), {
          TTL: 300,
          timeout: 4_000,
          vapidDetails: { subject: "mailto:soporte@opusorg.com", publicKey, privateKey },
        });
        delivered++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        const query = db.from("lamejor_demo_push_devices");
        if (status === 404 || status === 410) {
          await query.delete().eq("device_id", row.device_id);
        } else if (status === 429 || (status && status >= 500)) {
          await query.update({ last_day: null }).eq("device_id", row.device_id).eq("last_day", row.day_key);
        }
      }
    }));
  }
  return Response.json({ delivered, failed });
}
