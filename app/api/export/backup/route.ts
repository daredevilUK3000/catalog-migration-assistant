import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { buildCatalogBackup } from "@/lib/catalogBackup";
import type { Album, Track } from "@/types/catalog";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: albumRows, error: albumsError } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (albumsError) {
    return NextResponse.json({ error: `Failed to load albums: ${albumsError.message}` }, { status: 502 });
  }
  const albums = (albumRows ?? []) as Album[];

  if (albums.length === 0) {
    return NextResponse.json({ error: "No albums to back up." }, { status: 400 });
  }

  const albumIds = albums.map((a) => a.id);

  const { data: trackRows, error: tracksError } = await supabase
    .from("tracks")
    .select("*")
    .in("album_id", albumIds);
  if (tracksError) {
    return NextResponse.json({ error: `Failed to load tracks: ${tracksError.message}` }, { status: 502 });
  }
  const tracks = (trackRows ?? []) as Track[];

  const tracksByAlbumId = new Map<string, Track[]>();
  for (const track of tracks) {
    const list = tracksByAlbumId.get(track.album_id) ?? [];
    list.push(track);
    tracksByAlbumId.set(track.album_id, list);
  }

  const backup = buildCatalogBackup(albums, tracksByAlbumId);
  const filename = `catalog-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
