import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Album, CatalogIssue, Track } from "@/types/catalog";
import { computeAlbumScore, computeCatalogScore, buildPreflightSteps } from "@/lib/migrationScore";
import PreflightAnimation from "./PreflightAnimation";

// Reads live catalog/issue state — must not be prerendered as static
// build-time HTML.
export const dynamic = "force-dynamic";

export default async function PreflightPage({
  searchParams,
}: {
  searchParams: Promise<{ album_id?: string }>;
}) {
  const { album_id } = await searchParams;
  const devUserId = process.env.DEV_USER_ID;

  if (!devUserId) {
    return (
      <main className="min-h-screen bg-neutral-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-red-600">
            DEV_USER_ID is not configured. Set it in .env.local to use the catalog dashboard.
          </p>
        </div>
      </main>
    );
  }

  const supabase = createAdminClient();

  let albums: Album[];
  if (album_id) {
    const { data: albumRow } = await supabase
      .from("albums")
      .select("*")
      .eq("id", album_id)
      .eq("user_id", devUserId)
      .maybeSingle();
    if (!albumRow) notFound();
    albums = [albumRow as Album];
  } else {
    const { data: albumRows } = await supabase
      .from("albums")
      .select("*")
      .eq("user_id", devUserId)
      .order("created_at", { ascending: false });
    albums = (albumRows ?? []) as Album[];
  }

  const albumIds = albums.map((a) => a.id);

  // Sequential queries, not embedded joins — project convention.
  const [{ data: trackRows }, { data: issueRows }] = albumIds.length
    ? await Promise.all([
        supabase.from("tracks").select("*").in("album_id", albumIds),
        supabase.from("catalog_issues").select("*").eq("resolved", false).in("album_id", albumIds),
      ])
    : [{ data: [] }, { data: [] }];

  const tracks = (trackRows ?? []) as Track[];
  const issues = (issueRows ?? []) as CatalogIssue[];

  const steps = buildPreflightSteps(albums.length, tracks.length, issues);

  const scopeLabel = album_id ? `${albums[0]?.title ?? "Album"} — ${albums[0]?.artist ?? ""}` : "Your catalog";
  const backHref = album_id ? "/health" : "/health";

  let finalScore: number;
  let finalBand: ReturnType<typeof computeAlbumScore>["band"];
  let weakestLabel: string | undefined;

  if (album_id) {
    const albumScore = computeAlbumScore(albums[0].id, issues);
    finalScore = albumScore.score;
    finalBand = albumScore.band;
  } else {
    const catalogScore = computeCatalogScore(albums, issues);
    finalScore = catalogScore.average;
    finalBand = catalogScore.band;
    if (catalogScore.weakest) {
      const weakestAlbum = albums.find((a) => a.id === catalogScore.weakest!.album_id);
      weakestLabel = `${weakestAlbum?.title ?? "An album"} — ${catalogScore.weakest.score}%`;
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href={backHref} className="text-sm text-neutral-500 underline">
            ← Back to catalog health
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Migration preflight</h1>
          <p className="mt-1 text-neutral-600">{scopeLabel}</p>
        </div>

        <PreflightAnimation
          steps={steps}
          finalScore={finalScore}
          finalBand={finalBand}
          weakestLabel={weakestLabel}
        />
      </div>
    </main>
  );
}
