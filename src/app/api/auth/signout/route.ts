import { type NextRequest, NextResponse } from "next/server";

import { isSameOriginPost } from "@/core/security/csrf";

import { signOut } from "@/lib/actions/auth";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await signOut();
}
