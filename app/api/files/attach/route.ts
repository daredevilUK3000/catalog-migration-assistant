import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";

export const runtime = "nodejs";

// Artwork only — audio references are saved via
// app/api/tracks/audio-reference instead, straight to a DB column with no
// storage provider involved. Bucket is hardcoded, not taken from the
// request — "artwork" is the only legitimate value now, and accepting an
// arbitrary bucket name from the client would let a caller resolve a
// public URL against any bucket in the project.
const BUCKET = "artwork";

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

  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const albumId = body.album_id;
  const path = body.path;

  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "album_id is required." }, { status: 400 });
  }
  if (typeof path !== "string" || !path) {
    return NextResponse.json({ error: "path is required." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: album } = await supabase
    .from("albums")
    .select("id")
    .eq("id", albumId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
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
