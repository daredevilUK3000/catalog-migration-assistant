import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { r2ObjectKey, createR2UploadUrl } from "@/lib/r2/storage";

export const runtime = "nodejs";

// Keep ARTWORK_MAX_BYTES in sync with the artwork file_size_limit in
// supabase/schema.sql. AUDIO_MAX_BYTES has no such counterpart — audio
// goes to R2 (lib/r2/storage.ts), which has no comparable plan-level cap.
const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MAX_BYTES = 500 * 1024 * 1024;

const ARTWORK_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
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

  const kind = body.kind;
  const albumId = body.album_id;
  const trackId = body.track_id;
  const contentType = body.content_type;
  const size = body.size;

  if (kind !== "artwork" && kind !== "audio") {
    return NextResponse.json({ error: "kind must be 'artwork' or 'audio'." }, { status: 400 });
  }
  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "album_id is required." }, { status: 400 });
  }
  if (kind === "audio" && (typeof trackId !== "string" || !trackId)) {
    return NextResponse.json(
      { error: "track_id is required for audio uploads." },
      { status: 400 }
    );
  }
  if (typeof contentType !== "string") {
    return NextResponse.json({ error: "content_type is required." }, { status: 400 });
  }

  const mimeMap = kind === "artwork" ? ARTWORK_MIME_TO_EXT : AUDIO_MIME_TO_EXT;
  const ext = mimeMap[contentType];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported ${kind} file type '${contentType}'.` },
      { status: 400 }
    );
  }

  const maxBytes = kind === "artwork" ? ARTWORK_MAX_BYTES : AUDIO_MAX_BYTES;
  if (typeof size === "number" && size > maxBytes) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit for ${kind}.` },
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

  if (kind === "artwork") {
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

    return NextResponse.json({
      provider: "supabase",
      bucket,
      path: signed.path,
      token: signed.token,
    });
  }

  // Audio goes to R2 instead of Supabase — see the R2_ACCOUNT_ID etc. env
  // vars and lib/r2/storage.ts. Objects are private; nothing here is a
  // usable URL until a signed read URL is generated (app/api/files/attach).
  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("id")
    .eq("id", trackId as string)
    .eq("album_id", albumId)
    .maybeSingle();

  if (trackError || !track) {
    return NextResponse.json({ error: "Track not found on this album." }, { status: 404 });
  }

  const key = r2ObjectKey({ kind: "audio", userId: album.user_id, albumId: album.id, trackId: track.id, ext });

  let uploadUrl: string;
  try {
    uploadUrl = await createR2UploadUrl(key, contentType);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to prepare upload: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ provider: "r2", uploadUrl, key });
}
