import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { isPremiumUserId } from "@/lib/auth/premium";
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
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const isPremium = await isPremiumUserId(userId);

  let albums: Album[];
  let catalogLocked = false;
  if (album_id) {
    const { data: albumRow } = await supabase
      .from("albums")
      .select("*")
      .eq("id", album_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!albumRow) notFound();
    albums = [albumRow as Album];
  } else {
    const { data: albumRows } = await supabase
      .from("albums")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const allAlbums = (albumRows ?? []) as Album[];
    // Whole-catalog preflight is a premium action, same as the /health
    // catalog score — a non-premium user only gets their most recently
    // added album, gated server-side.
    albums = isPremium ? allAlbums : allAlbums.slice(0, 1);
    catalogLocked = !isPremium && allAlbums.length > albums.length;
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

        {catalogLocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-neutral-700">
              This preflight covers 1 album. Unlock the full catalog with Own Your Music.
            </p>
            <Link
              href="/billing"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Unlock on /billing
            </Link>
          </div>
        )}

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
