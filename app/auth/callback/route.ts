import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing: trade the one-time code for a session cookie.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (isSupabaseMode && code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/app", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
