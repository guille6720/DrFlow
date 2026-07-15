import { NextResponse } from "next/server";
import { getReleasePayload } from "@/lib/app-release";

export const dynamic = "force-dynamic";

/** Versión actual para que web/PWA detecten actualizaciones. */
export async function GET() {
  return NextResponse.json(getReleasePayload(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
