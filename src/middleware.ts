import { type NextRequest } from "next/server";

import { updateSession } from "@/core/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Static tutorial narration WAVs must bypass auth redirects.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|sw-portal.js|manifest.webmanifest|tutoriales/narration/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wav|mp3|ogg)$).*)",
  ],
};
