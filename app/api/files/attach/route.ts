import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Artwork only — audio references are saved via
// app/api/tracks/audio-reference instead, straight to a DB column with no
// storage provider involved.
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
  const bucket = body.bucket;
  const path = body.path;

  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "album_id is required." }, { status: 400 });
  }
  if (typeof bucket !== "string" || !bucket || typeof path !== "string" || !path) {
    return NextResponse.json({ error: "bucket and path are required." }, { status: 400 });
  }

  const supabase = createAdminClient();

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
