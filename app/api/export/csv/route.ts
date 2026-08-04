import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { buildExportCsv } from "@/lib/exportPack";
import type { Album, Track, DistributorProfile } from "@/types/catalog";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const albumId = request.nextUrl.searchParams.get("id");
  const slug = request.nextUrl.searchParams.get("distributor");

  if (!albumId || !slug) {
    return NextResponse.json({ error: "id and distributor are required." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: albumRow } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!albumRow) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }
  const album = albumRow as Album;

  const { data: profileRow } = await supabase
    .from("distributor_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!profileRow) {
    return NextResponse.json({ error: "Distributor profile not found." }, { status: 404 });
  }
  const profile = profileRow as DistributorProfile;

  if (!profile.supports_bulk_csv) {
    return NextResponse.json(
      {
        error: `${profile.display_name} doesn't support bulk CSV import — use the reference sheet instead.`,
      },
      { status: 400 }
    );
  }

  const { data: trackRows } = await supabase
    .from("tracks")
    .select("*")
    .eq("album_id", albumId)
    .order("position");
  const tracks = (trackRows ?? []) as Track[];

  const csv = buildExportCsv(profile, album, tracks);
  const safeTitle = album.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "release";
  const filename = `${safeTitle}-${profile.slug}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
