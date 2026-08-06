import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePremiumUserId } from "@/lib/auth/premium";
import { computeCatalogScore } from "@/lib/migrationScore";
import type { Album, Track, CatalogIssue, DistributorProfile, MigrationRecord } from "@/types/catalog";
import BatchExportForm, { type BatchExportAlbum } from "./BatchExportForm";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// Reads live catalog/health/migration state — must not be prerendered.
export const dynamic = "force-dynamic";

export default async function BatchExportPage({
  searchParams,
}: {
  searchParams: Promise<{ distributor?: string }>;
}) {
  const { distributor } = await searchParams;

  // Same premium gate as the single-album Export Pack page — this is that
  // same feature applied across the catalog, not a new capability.
  const gate = await requirePremiumUserId();
  if (!gate.ok) {
    redirect(gate.status === 401 ? "/login" : "/billing");
  }
  const userId = gate.userId;

  const supabase = createAdminClient();

  const { data: albumRows } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const albums = (albumRows ?? []) as Album[];
  const albumIds = albums.map((a) => a.id);

  const { data: profileRows } = await supabase
    .from("distributor_profiles")
    .select("*")
    .order("display_name");
  const profiles = (profileRows ?? []) as DistributorProfile[];

  const selectedProfile = distributor ? (profiles.find((p) => p.slug === distributor) ?? null) : null;

  if (albums.length === 0) {
    return (
      <main className="min-h-screen bg-paper px-6 py-10">
        <div className="mx-auto max-w-4xl space-y-8">
          <PageHeader
            title="Batch export packs"
            description="Generate export packs for several albums in one pass."
          />
          <EmptyState message="No confirmed albums yet." />
        </div>
      </main>
    );
  }

  // Sequential queries, not embedded joins — project convention.
  const [{ data: trackRows }, { data: issueRows }, { data: recordRows }] = await Promise.all([
    supabase.from("tracks").select("*").in("album_id", albumIds).order("position"),
    supabase.from("catalog_issues").select("*").eq("resolved", false).in("album_id", albumIds),
    supabase.from("migration_records").select("*").in("album_id", albumIds),
  ]);
  const tracks = (trackRows ?? []) as Track[];
  const issues = (issueRows ?? []) as CatalogIssue[];
  const records = (recordRows ?? []) as MigrationRecord[];

  const tracksByAlbum = new Map<string, Track[]>();
  for (const t of tracks) {
    const list = tracksByAlbum.get(t.album_id) ?? [];
    list.push(t);
    tracksByAlbum.set(t.album_id, list);
  }

  const catalogScore = computeCatalogScore(albums, issues);
  const scoreByAlbum = new Map(catalogScore.albums.map((s) => [s.album_id, s]));

  const recordByAlbum = selectedProfile
    ? new Map(
        records
          .filter((r) => r.target_distributor_id === selectedProfile.id)
          .map((r) => [r.album_id, r])
      )
    : new Map<string, MigrationRecord>();

  const batchAlbums: BatchExportAlbum[] = albums.map((album) => {
    const albumTracks = tracksByAlbum.get(album.id) ?? [];
    const score = scoreByAlbum.get(album.id);
    const record = recordByAlbum.get(album.id);

    const lastEdited = [album.updated_at, ...albumTracks.map((t) => t.updated_at)]
      .map((d) => new Date(d).getTime())
      .reduce((max, t) => Math.max(max, t), 0);
    const generatedAt = record?.export_pack_generated_at
      ? new Date(record.export_pack_generated_at).getTime()
      : null;
    const upToDate = generatedAt !== null && generatedAt >= lastEdited;

    return {
      id: album.id,
      title: album.title,
      artist: album.artist,
      trackCount: albumTracks.length,
      band: score?.band ?? "not_ready",
      score: score?.score ?? 0,
      alreadyGenerated: generatedAt !== null,
      upToDate,
    };
  });

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <PageHeader
          title="Batch export packs"
          description="Pick a target distributor, then generate export packs for several albums in one pass instead of opening each one individually."
        />
        <BatchExportForm
          albums={batchAlbums}
          profiles={profiles}
          selectedDistributorSlug={selectedProfile?.slug ?? null}
        />
      </div>
    </main>
  );
}
