import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin client using the service role key. Bypasses RLS.
 *
 * Project convention (carried over from other apps in this portfolio):
 * - Use this client for server-side data fetching in route handlers / server actions.
 * - Run sequential queries instead of relying on PostgREST embedded joins —
 *   joins have silently returned empty results in this Supabase setup before.
 *   e.g. fetch albums, then fetch tracks for those album ids, then merge in JS.
 * - Never expose this client or the service role key to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
