import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Album, CatalogIssue, Track } from "@/types/catalog";
import { MigrationReportDocument } from "@/lib/migrationReportPdf";

export const runtime = "nodejs";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
}

export async function GET(request: NextRequest) {
  const devUserId = process.env.DEV_USER_ID;
  if (!devUserId) {
    return NextResponse.json(
      { error: "DEV_USER_ID is not configured on the server." },
      { status: 500 }
    );
  }

  const albumId = request.nextUrl.searchParams.get("album_id");
  const supabase = createAdminClient();

  let albums: Album[];
  if (albumId) {
    const { data: albumRow, error } = await supabase
      .from("albums")
      .select("*")
      .eq("id", albumId)
      .eq("user_id", devUserId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: `Failed to load album: ${error.message}` }, { status: 502 });
    }
    if (!albumRow) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
    albums = [albumRow as Album];
  } else {
    const { data: albumRows, error } = await supabase
      .from("albums")
      .select("*")
      .eq("user_id", devUserId)
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: `Failed to load albums: ${error.message}` }, { status: 502 });
    }
    albums = (albumRows ?? []) as Album[];
  }

  if (albums.length === 0) {
    return NextResponse.json({ error: "No albums to report on." }, { status: 400 });
  }

  const albumIds = albums.map((a) => a.id);

  // Sequential queries, not embedded joins — project convention.
  const [{ data: trackRows, error: tracksError }, { data: issueRows, error: issuesError }] =
    await Promise.all([
      supabase.from("tracks").select("*").in("album_id", albumIds),
      supabase.from("catalog_issues").select("*").eq("resolved", false).in("album_id", albumIds),
    ]);

  if (tracksError) {
    return NextResponse.json({ error: `Failed to load tracks: ${tracksError.message}` }, { status: 502 });
  }
  if (issuesError) {
    return NextResponse.json({ error: `Failed to load issues: ${issuesError.message}` }, { status: 502 });
  }

  const tracks = (trackRows ?? []) as Track[];
  const issues = (issueRows ?? []) as CatalogIssue[];

  const tracksByAlbumId = new Map<string, Track[]>();
  for (const track of tracks) {
    const list = tracksByAlbumId.get(track.album_id) ?? [];
    list.push(track);
    tracksByAlbumId.set(track.album_id, list);
  }

  const issuesByAlbum = new Map<string, CatalogIssue[]>();
  for (const issue of issues) {
    const list = issuesByAlbum.get(issue.album_id) ?? [];
    list.push(issue);
    issuesByAlbum.set(issue.album_id, list);
  }

  const generatedAt = new Date().toISOString().slice(0, 10);

  const buffer = await renderToBuffer(
    MigrationReportDocument({ albums, tracksByAlbumId, issuesByAlbum, generatedAt })
  );

  const filename =
    albums.length === 1
      ? `migration-report-${slugify(albums[0].title)}-${generatedAt}.pdf`
      : `migration-report-catalog-${generatedAt}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
