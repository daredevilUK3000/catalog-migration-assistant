import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Saves a local audio reference — a verified filename/relative path (via
// the File System Access API, see lib/localAudio.ts) or a self-attested one
// (manual fallback for browsers without that API) — straight to
// tracks.audio_file_url. No file bytes ever pass through this route; there
// is nothing to sign or upload.
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
  const trackId = body.track_id;
  const reference = body.reference;

  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "album_id is required." }, { status: 400 });
  }
  if (typeof trackId !== "string" || !trackId) {
    return NextResponse.json({ error: "track_id is required." }, { status: 400 });
  }
  if (reference !== null && (typeof reference !== "string" || !reference.trim())) {
    return NextResponse.json(
      { error: "reference must be a non-empty string, or null to clear it." },
      { status: 400 }
    );
  }

  const value = reference === null ? null : reference.trim();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("tracks")
    .update({ audio_file_url: value })
    .eq("id", trackId)
    .eq("album_id", albumId);

  if (error) {
    return NextResponse.json(
      { error: `Failed to save audio reference: ${error.message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ reference: value });
}
