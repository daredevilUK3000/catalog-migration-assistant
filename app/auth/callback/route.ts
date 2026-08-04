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
  // Signup confirmation is the only flow that lands here right now, so
  // defaulting to the onboarding page is safe — a future email flow that
  // isn't a first-time signup (password reset, magic link) should pass its
  // own explicit ?next= rather than relying on this default.
  const next = searchParams.get("next") ?? "/getting-started";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
