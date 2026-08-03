import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const albumId =
    typeof raw === "object" && raw !== null && typeof (raw as Record<string, unknown>).album_id === "string"
      ? ((raw as Record<string, unknown>).album_id as string)
      : "";
  if (!albumId) {
    return NextResponse.json({ error: "album_id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: album, error: albumFetchError } = await supabase
    .from("albums")
    .select("id, user_id")
    .eq("id", albumId)
    .maybeSingle();
  if (albumFetchError || !album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  // Storage isn't covered by the DB's `on delete cascade` — clean up the
  // artwork/audio objects ourselves before removing the row. Paths are
  // deterministic (`{user_id}/{album_id}/...`, see app/api/files/sign),
  // so listing that one folder per bucket is enough; no need to touch
  // tracks first.
  for (const bucket of ["artwork", "audio"] as const) {
    const prefix = `${album.user_id}/${album.id}`;
    const { data: objects } = await supabase.storage.from(bucket).list(prefix);
    if (objects && objects.length > 0) {
      const paths = objects.map((o) => `${prefix}/${o.name}`);
      await supabase.storage.from(bucket).remove(paths);
    }
  }

  // tracks, catalog_issues, and migration_records all cascade from albums
  // via foreign key, so deleting the album row is enough on the DB side.
  const { error: deleteError } = await supabase.from("albums").delete().eq("id", albumId);
  if (deleteError) {
    return NextResponse.json(
      { error: `Failed to delete album: ${deleteError.message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
