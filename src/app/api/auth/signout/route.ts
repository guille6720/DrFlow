import { signOut } from "@/lib/actions/auth";

export async function POST() {
  await signOut();
}
