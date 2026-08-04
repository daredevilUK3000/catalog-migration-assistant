import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Artwork only — audio files stay on the musician's own machine and are
// never uploaded (see lib/localAudio.ts and
// app/api/tracks/audio-reference). Keep in sync with ARTWORK_MAX_BYTES in
// lib/uploadFile.ts and the artwork file_size_limit in supabase/schema.sql.
const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;

const ARTWORK_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

  const albumId = body.album_id;
  const contentType = body.content_type;
  const size = body.size;

  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "album_id is required." }, { status: 400 });
  }
  if (typeof contentType !== "string") {
    return NextResponse.json({ error: "content_type is required." }, { status: 400 });
  }

  const ext = ARTWORK_MIME_TO_EXT[contentType];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported artwork file type '${contentType}'.` },
      { status: 400 }
    );
  }

  if (typeof size === "number" && size > ARTWORK_MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.round(ARTWORK_MAX_BYTES / (1024 * 1024))}MB limit for artwork.` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("id, user_id")
    .eq("id", albumId)
    .maybeSingle();

  if (albumError || !album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const bucket = "artwork";
  const path = `${album.user_id}/${album.id}/cover.${ext}`;

  // upsert: true — a redo/replace upload reuses the same deterministic path.
  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: true });

  if (signError || !signed) {
    return NextResponse.json(
      { error: `Failed to prepare upload: ${signError?.message ?? "unknown error"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ bucket, path: signed.path, token: signed.token });
}
