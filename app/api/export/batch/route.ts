import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePremiumUserId } from "@/lib/auth/premium";
import { buildExportPack, buildPasteQueue, buildExportCsv } from "@/lib/exportPack";
import type { Album, Track, DistributorProfile, MigrationRecord } from "@/types/catalog";
import { MIGRATION_STATUS_ORDER } from "@/types/catalog";

export const runtime = "nodejs";

interface BatchExportBody {
  album_ids: string[];
  distributor_slug: string;
}

function parseBody(raw: unknown): BatchExportBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.album_ids) || r.album_ids.length === 0) return null;
  const albumIds = r.album_ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (albumIds.length === 0) return null;

  const slug = typeof r.distributor_slug === "string" ? r.distributor_slug.trim() : "";
  if (!slug) return null;

  return { album_ids: albumIds, distributor_slug: slug };
}

function safeFilename(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "release";
}

export async function POST(request: NextRequest) {
  // Batch generation is a full-catalog action — same premium gate as
  // single-album Export Pack, full Catalog Health, and the other
  // catalog-scope bulk-apply routes.
  const gate = await requirePremiumUserId();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const userId = gate.userId;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: "album_ids (non-empty array) and distributor_slug are required." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: profileRow, error: profileError } = await supabase
    .from("distributor_profiles")
    .select("*")
    .eq("slug", body.distributor_slug)
    .maybeSingle();
  if (profileError || !profileRow) {
    return NextResponse.json({ error: "Distributor profile not found." }, { status: 404 });
  }
  const profile = profileRow as DistributorProfile;

  const { data: albumRows, error: albumsError } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", userId)
    .in("id", body.album_ids);
  if (albumsError) {
    return NextResponse.json(
      { error: `Failed to load albums: ${albumsError.message}` },
      { status: 502 }
    );
  }
  const albums = (albumRows ?? []) as Album[];
  const skipped = body.album_ids.length - albums.length;

  if (albums.length === 0) {
    return NextResponse.json({ error: "None of the requested albums were found." }, { status: 404 });
  }

  const albumIds = albums.map((a) => a.id);
  const { data: trackRows, error: tracksError } = await supabase
    .from("tracks")
    .select("*")
    .in("album_id", albumIds)
    .order("position");
  if (tracksError) {
    return NextResponse.json(
      { error: `Failed to load tracks: ${tracksError.message}` },
      { status: 502 }
    );
  }
  const tracks = (trackRows ?? []) as Track[];
  const tracksByAlbum = new Map<string, Track[]>();
  for (const track of tracks) {
    const list = tracksByAlbum.get(track.album_id) ?? [];
    list.push(track);
    tracksByAlbum.set(track.album_id, list);
  }

  const zip = new JSZip();
  const now = new Date().toISOString();

  for (const album of albums) {
    const albumTracks = tracksByAlbum.get(album.id) ?? [];
    const base = `${safeFilename(album.title)}-${profile.slug}`;

    if (profile.supports_bulk_csv) {
      const csv = buildExportCsv(profile, album, albumTracks);
      zip.file(`${base}.csv`, csv);
    } else {
      const pack = buildExportPack(profile, album, albumTracks);
      const queue = buildPasteQueue(pack);
      const json = JSON.stringify(
        { album: `${album.title} — ${album.artist}`, distributor: profile.display_name, fields: queue },
        null,
        2
      );
      zip.file(`${base}.json`, json);
    }
  }

  // Record that a pack was generated for each album against this
  // distributor — creates the migration_record if one doesn't exist yet
  // (same as clicking "Start tracking" manually), and never regresses an
  // album's status that's already further along (e.g. already "uploaded").
  const { data: existingRecordRows } = await supabase
    .from("migration_records")
    .select("*")
    .eq("target_distributor_id", profile.id)
    .in("album_id", albumIds);
  const existingByAlbum = new Map(
    ((existingRecordRows ?? []) as MigrationRecord[]).map((r) => [r.album_id, r])
  );

  const exportGeneratedIndex = MIGRATION_STATUS_ORDER.indexOf("export_pack_generated");

  // Best-effort by design: the zip is the actual deliverable the user is
  // waiting on, so a failure to update tracking bookkeeping shouldn't block
  // or fail the whole response — it just means that album's Migration
  // tracker status/staleness watermark won't reflect this generation, same
  // as if the user never clicked "Start tracking" for it.
  for (const album of albums) {
    const existing = existingByAlbum.get(album.id);
    if (existing) {
      const currentIndex = MIGRATION_STATUS_ORDER.indexOf(existing.status);
      const updates: Record<string, unknown> = { export_pack_generated_at: now };
      if (currentIndex < exportGeneratedIndex) {
        updates.status = "export_pack_generated";
      }
      await supabase.from("migration_records").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("migration_records").insert({
        album_id: album.id,
        target_distributor_id: profile.id,
        status: "export_pack_generated",
        export_pack_generated_at: now,
      });
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const filename = `export-packs-${profile.slug}-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Generated-Count": String(albums.length),
      "X-Skipped-Count": String(skipped),
    },
  });
}
