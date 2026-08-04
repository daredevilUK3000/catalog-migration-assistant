import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { runCatalogHealthCheck, findingKey } from "@/lib/catalogHealth";
import type { Album, Track } from "@/types/catalog";

export const runtime = "nodejs";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: albumRows, error: albumsError } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", userId);

  if (albumsError) {
    return NextResponse.json(
      { error: `Failed to load albums: ${albumsError.message}` },
      { status: 502 }
    );
  }
  const albums = (albumRows ?? []) as Album[];

  if (albums.length === 0) {
    return NextResponse.json({ issues_found: 0, issues_resolved: 0 });
  }

  const albumIds = albums.map((a) => a.id);

  // Sequential queries, not an embedded join — project convention.
  const { data: trackRows, error: tracksError } = await supabase
    .from("tracks")
    .select("*")
    .in("album_id", albumIds);

  if (tracksError) {
    return NextResponse.json(
      { error: `Failed to load tracks: ${tracksError.message}` },
      { status: 502 }
    );
  }
  const tracks = (trackRows ?? []) as Track[];

  const tracksByAlbumId = new Map<string, Track[]>();
  for (const track of tracks) {
    const list = tracksByAlbumId.get(track.album_id) ?? [];
    list.push(track);
    tracksByAlbumId.set(track.album_id, list);
  }

  const findings = await runCatalogHealthCheck(albums, tracksByAlbumId);
  const findingsByKey = new Map(findings.map((f) => [findingKey(f), f]));

  const { data: existingRows, error: existingError } = await supabase
    .from("catalog_issues")
    .select("id, album_id, track_id, issue_type")
    .eq("resolved", false)
    .in("album_id", albumIds);

  if (existingError) {
    return NextResponse.json(
      { error: `Failed to load existing issues: ${existingError.message}` },
      { status: 502 }
    );
  }

  const existingByKey = new Map(
    (existingRows ?? []).map((row) => [
      findingKey({ album_id: row.album_id, track_id: row.track_id, issue_type: row.issue_type }),
      row.id as string,
    ])
  );

  // Reconcile rather than wipe-and-rewrite: a finding already tracked stays
  // untouched (preserves created_at), a new finding is inserted, and a
  // previously-tracked finding that no longer reproduces is auto-resolved —
  // there's no separate "dismiss" action, resolved just means "still true".
  const toInsert = [...findingsByKey.entries()]
    .filter(([key]) => !existingByKey.has(key))
    .map(([, f]) => f);

  const toResolveIds = [...existingByKey.entries()]
    .filter(([key]) => !findingsByKey.has(key))
    .map(([, id]) => id);

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from("catalog_issues").insert(toInsert);
    if (insertError) {
      return NextResponse.json(
        { error: `Failed to save issues: ${insertError.message}` },
        { status: 502 }
      );
    }
  }

  if (toResolveIds.length > 0) {
    const { error: resolveError } = await supabase
      .from("catalog_issues")
      .update({ resolved: true })
      .in("id", toResolveIds);
    if (resolveError) {
      return NextResponse.json(
        { error: `Failed to clear resolved issues: ${resolveError.message}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ issues_found: toInsert.length, issues_resolved: toResolveIds.length });
}
