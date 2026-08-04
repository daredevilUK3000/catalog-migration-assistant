import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Lands here after clicking a signup-confirmation (or future password-reset
 * /magic-link) email. @supabase/ssr's browser client defaults to the PKCE
 * flow, so Supabase hands back a one-time `code` in the query string rather
 * than session tokens in the URL fragment — nothing auto-detects or
 * exchanges that `code` the way the old implicit flow did. This route is
 * the missing second leg: exchange it for a real session, server-side,
 * where cookies can actually be set (a Server Component can't).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/health";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
