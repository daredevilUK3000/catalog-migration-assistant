import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";

export const runtime = "nodejs";

interface ConfirmTrackInput {
  title: string;
  isrc: string | null;
}

interface ConfirmImportBody {
  title: string;
  artist: string;
  release_date: string | null;
  upc: string | null;
  genre: string | null;
  source_distributor: string | null;
  tracks: ConfirmTrackInput[];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Validates the posted draft at this system boundary — deeper catalog-quality
 * checks (ISRC format, duplicates, etc.) belong to the health-check step, not here. */
function parseBody(raw: unknown): ConfirmImportBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  const artist = typeof r.artist === "string" ? r.artist.trim() : "";
  if (!title || !artist || !Array.isArray(r.tracks) || r.tracks.length === 0) {
    return null;
  }

  const tracks: ConfirmTrackInput[] = [];
  for (const item of r.tracks) {
    if (typeof item !== "object" || item === null) return null;
    const t = item as Record<string, unknown>;
    const trackTitle = typeof t.title === "string" ? t.title.trim() : "";
    if (!trackTitle) return null;
    tracks.push({ title: trackTitle, isrc: optionalString(t.isrc) });
  }

  return {
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
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

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
          "Missing or invalid fields. Title, artist, and at least one track with a title are required.",
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .insert({
      user_id: userId,
      title: body.title,
      artist: body.artist,
      release_date: body.release_date,
      upc: body.upc,
      genre: body.genre,
      source_distributor: body.source_distributor,
      import_status: "confirmed",
    })
    .select("id")
    .single();

  if (albumError || !album) {
    return NextResponse.json(
      { error: `Failed to save album: ${albumError?.message ?? "unknown error"}` },
      { status: 502 }
    );
  }

  const trackRows = body.tracks.map((track, index) => ({
    album_id: album.id as string,
    position: index + 1,
    title: track.title,
    isrc: track.isrc,
  }));

  const { error: tracksError } = await supabase.from("tracks").insert(trackRows);

  if (tracksError) {
    // Compensate — don't leave a confirmed album with no tracks behind.
    await supabase.from("albums").delete().eq("id", album.id);
    return NextResponse.json(
      { error: `Failed to save tracks: ${tracksError.message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ album_id: album.id, track_count: trackRows.length });
}
