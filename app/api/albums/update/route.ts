import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Album, Track, Credit } from "@/types/catalog";

export const runtime = "nodejs";

interface TrackInput {
  id?: string;
  title: string;
  isrc: string | null;
  lyrics_plain: string | null;
  lyrics_synced: string | null;
  credits: Credit[];
}

interface UpdateBody {
  album_id: string;
  title: string;
  artist: string;
  release_date: string | null;
  upc: string | null;
  genre: string | null;
  source_distributor: string | null;
  tracks: TrackInput[];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function parseCredits(raw: unknown): Credit[] | null {
  if (!Array.isArray(raw)) return null;
  const credits: Credit[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const c = item as Record<string, unknown>;
    const role = typeof c.role === "string" ? c.role.trim() : "";
    const name = typeof c.name === "string" ? c.name.trim() : "";
    if (!role || !name) return null;
    const credit: Credit = { role, name };
    if (typeof c.split_percent === "number" && Number.isFinite(c.split_percent)) {
      credit.split_percent = c.split_percent;
    }
    credits.push(credit);
  }
  return credits;
}

/** Validates the posted edit at this system boundary — catalog-quality
 * checks (ISRC format, duplicates, etc.) belong to the health-check step. */
function parseBody(raw: unknown): UpdateBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const albumId = typeof r.album_id === "string" ? r.album_id : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const artist = typeof r.artist === "string" ? r.artist.trim() : "";
  if (!albumId || !title || !artist || !Array.isArray(r.tracks) || r.tracks.length === 0) {
    return null;
  }

  const tracks: TrackInput[] = [];
  for (const item of r.tracks) {
    if (typeof item !== "object" || item === null) return null;
    const t = item as Record<string, unknown>;
    const trackTitle = typeof t.title === "string" ? t.title.trim() : "";
    if (!trackTitle) return null;
    const credits = parseCredits(t.credits ?? []);
    if (credits === null) return null;
    tracks.push({
      id: typeof t.id === "string" && t.id ? t.id : undefined,
      title: trackTitle,
      isrc: optionalString(t.isrc),
      lyrics_plain: optionalString(t.lyrics_plain),
      lyrics_synced: optionalString(t.lyrics_synced),
      credits,
    });
  }

  return {
    album_id: albumId,
    title,
    artist,
    release_date: optionalString(r.release_date),
    upc: optionalString(r.upc),
    genre: optionalString(r.genre),
    source_distributor: optionalString(r.source_distributor),
    tracks,
  };
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid fields. Title, artist, and at least one track with a title and valid credits are required.",
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: existingAlbum, error: albumFetchError } = await supabase
    .from("albums")
    .select("id")
    .eq("id", body.album_id)
    .maybeSingle();
  if (albumFetchError || !existingAlbum) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const { data: existingTrackRows, error: existingTracksError } = await supabase
    .from("tracks")
    .select("id")
    .eq("album_id", body.album_id);
  if (existingTracksError) {
    return NextResponse.json(
      { error: `Failed to load existing tracks: ${existingTracksError.message}` },
      { status: 502 }
    );
  }
  const existingIds = new Set((existingTrackRows ?? []).map((t) => t.id as string));
  const submittedIds = new Set(
    body.tracks.map((t) => t.id).filter((id): id is string => Boolean(id))
  );
  const idsToDelete = [...existingIds].filter((id) => !submittedIds.has(id));

  // 1. Album's own fields — deliberately not touching artwork_url or
  // import_status, which this form doesn't own.
  const { error: albumUpdateError } = await supabase
    .from("albums")
    .update({
      title: body.title,
      artist: body.artist,
      release_date: body.release_date,
      upc: body.upc,
      genre: body.genre,
      source_distributor: body.source_distributor,
    })
    .eq("id", body.album_id);
  if (albumUpdateError) {
    return NextResponse.json(
      { error: `Failed to save album: ${albumUpdateError.message}` },
      { status: 502 }
    );
  }

  // 2. Remove tracks the user deleted in the editor.
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase.from("tracks").delete().in("id", idsToDelete);
    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to remove tracks: ${deleteError.message}` },
        { status: 502 }
      );
    }
  }

  // 3. Stage every kept (existing) track onto a temporary negative position
  // first. `position` is unique per album, and reordering is a permutation —
  // writing final positions directly risks a transient collision when two
  // tracks swap places (A -> 2 while B still sits at 2). Vacating the
  // positive position space first avoids that regardless of how the order
  // changed.
  const keptTracks = body.tracks.filter((t) => t.id && existingIds.has(t.id));
  for (let i = 0; i < keptTracks.length; i++) {
    const { error } = await supabase
      .from("tracks")
      .update({ position: -(i + 1) })
      .eq("id", keptTracks[i].id as string);
    if (error) {
      return NextResponse.json(
        { error: `Failed to reorder tracks: ${error.message}` },
        { status: 502 }
      );
    }
  }

  // 4. Insert brand-new tracks at their final position (index in the full
  // submitted order) — safe now that every kept track has vacated the
  // positive position space.
  for (let i = 0; i < body.tracks.length; i++) {
    const track = body.tracks[i];
    if (track.id) continue;
    const { error } = await supabase.from("tracks").insert({
      album_id: body.album_id,
      position: i + 1,
      title: track.title,
      isrc: track.isrc,
      lyrics_plain: track.lyrics_plain,
      lyrics_synced: track.lyrics_synced,
      credits: track.credits,
    });
    if (error) {
      return NextResponse.json(
        { error: `Failed to add track "${track.title}": ${error.message}` },
        { status: 502 }
      );
    }
  }

  // 5. Move kept tracks from their temporary negative position to their
  // real final position, saving their edited content at the same time. No
  // collision is possible: final positions are a permutation of 1..N over
  // the full submitted list, and step 4 already claimed the slots that
  // belong to new tracks.
  for (let i = 0; i < body.tracks.length; i++) {
    const track = body.tracks[i];
    if (!track.id) continue;
    const { error } = await supabase
      .from("tracks")
      .update({
        position: i + 1,
        title: track.title,
        isrc: track.isrc,
        lyrics_plain: track.lyrics_plain,
        lyrics_synced: track.lyrics_synced,
        credits: track.credits,
      })
      .eq("id", track.id);
    if (error) {
      return NextResponse.json(
        { error: `Failed to save track "${track.title}": ${error.message}` },
        { status: 502 }
      );
    }
  }

  const { data: album } = await supabase
    .from("albums")
    .select("*")
    .eq("id", body.album_id)
    .maybeSingle();
  const { data: tracks } = await supabase
    .from("tracks")
    .select("*")
    .eq("album_id", body.album_id)
    .order("position");

  return NextResponse.json({ album: album as Album, tracks: (tracks ?? []) as Track[] });
}
