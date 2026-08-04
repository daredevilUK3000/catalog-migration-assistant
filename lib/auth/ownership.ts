import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True if albumId exists and belongs to userId. The admin client
 * (lib/supabase/admin.ts) bypasses RLS entirely, so every route that
 * receives an album_id (or resolves one, e.g. via a track or migration
 * record) from the client must call this before reading or writing
 * anything — nothing enforces ownership on its own.
 */
export async function ownsAlbum(
  supabase: SupabaseClient,
  albumId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("albums")
    .select("id")
    .eq("id", albumId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}
