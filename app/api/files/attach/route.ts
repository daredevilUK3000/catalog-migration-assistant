import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createR2ReadUrl } from "@/lib/r2/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const kind = body.kind;
  const albumId = body.album_id;
  const trackId = body.track_id;

  if (kind !== "artwork" && kind !== "audio") {
    return NextResponse.json({ error: "kind must be 'artwork' or 'audio'." }, { status: 400 });
  }
  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "album_id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (kind === "artwork") {
    const bucket = body.bucket;
    const path = body.path;
    if (typeof bucket !== "string" || !bucket || typeof path !== "string" || !path) {
      return NextResponse.json({ error: "bucket and path are required." }, { status: 400 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const url = publicUrlData.publicUrl;

    const { error } = await supabase.from("albums").update({ artwork_url: url }).eq("id", albumId);
    if (error) {
      return NextResponse.json(
        { error: `Failed to save artwork: ${error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ url });
  }

  // Audio (R2): store the object key, not a URL — the bucket is private, so
  // every read needs a freshly generated signed URL rather than one saved
  // at upload time (see lib/r2/storage.ts).
  if (typeof trackId !== "string" || !trackId) {
    return NextResponse.json(
      { error: "track_id is required for audio uploads." },
      { status: 400 }
    );
  }
  const key = body.key;
  if (typeof key !== "string" || !key) {
    return NextResponse.json({ error: "key is required for audio uploads." }, { status: 400 });
  }

  const { error } = await supabase
    .from("tracks")
    .update({ audio_file_url: key })
    .eq("id", trackId)
    .eq("album_id", albumId);
  if (error) {
    return NextResponse.json(
      { error: `Failed to save audio file: ${error.message}` },
      { status: 502 }
    );
  }

  let url: string;
  try {
    url = await createR2ReadUrl(key);
  } catch (err) {
    return NextResponse.json(
      { error: `Saved, but failed to generate a playback URL: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ url });
}
