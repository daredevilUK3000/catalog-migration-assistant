import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the current user's id: a real signed-in Supabase Auth session if
 * one exists, otherwise DEV_USER_ID as a local-dev convenience — but only
 * outside a production build. `next build`/`next start` (including every
 * Vercel deployment, preview or production) set NODE_ENV=production; only
 * `next dev` doesn't. So the deployed app always requires real sign-in,
 * while `npm run dev` keeps working exactly as before with no login needed.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;

  if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) {
    return process.env.DEV_USER_ID;
  }

  return null;
}
