import { signOut } from "@/lib/actions/auth";
import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginPost } from "@/core/security/csrf";

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await signOut();
}
