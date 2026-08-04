import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import type { Album, CatalogIssue } from "@/types/catalog";
import { computeCatalogScore, SCORE_FRAMING_NOTE } from "@/lib/migrationScore";
import { ScoreBadge, ScoreProgressBar } from "./scoreDisplay";
import RunHealthCheckButton from "./RunHealthCheckButton";
import DeleteAlbumButton from "./DeleteAlbumButton";
import GenerateReportButton from "./GenerateReportButton";

// This page reads live catalog/issue state that changes via user actions
// (import, file attachment, running a health check) — it must not be
// prerendered as static build-time HTML.
export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const supabase = createAdminClient();

  const { data: albumRows } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const albums = (albumRows ?? []) as Album[];
  const albumIds = albums.map((a) => a.id);

  // Sequential queries, not embedded joins — project convention.
  const [{ data: trackRows }, { data: issueRows }] = albumIds.length
    ? await Promise.all([
        supabase.from("tracks").select("id, album_id").in("album_id", albumIds),
        supabase
          .from("catalog_issues")
          .select("*")
          .eq("resolved", false)
          .in("album_id", albumIds)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const tracks = (trackRows ?? []) as { id: string; album_id: string }[];
  const issues = (issueRows ?? []) as CatalogIssue[];

  const trackCountByAlbum = new Map<string, number>();
  for (const t of tracks) {
    trackCountByAlbum.set(t.album_id, (trackCountByAlbum.get(t.album_id) ?? 0) + 1);
  }

  const issuesByAlbum = new Map<string, CatalogIssue[]>();
  for (const issue of issues) {
    const list = issuesByAlbum.get(issue.album_id) ?? [];
    list.push(issue);
    issuesByAlbum.set(issue.album_id, list);
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const ready = errorCount === 0;

  const catalogScore = computeCatalogScore(albums, issues);
  const albumScoreById = new Map(catalogScore.albums.map((s) => [s.album_id, s]));

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Catalog health</h1>
            <p className="mt-1 text-neutral-600">
              Deterministic checks against your confirmed catalog — no AI involved.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/health/preflight"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900"
            >
              Preflight check
            </Link>
            {albums.length > 0 && <GenerateReportButton label="Generate report" />}
            <RunHealthCheckButton />
          </div>
        </div>

        {albums.length > 0 && (
          <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold text-neutral-900">
                  {catalogScore.average}%
                </span>
                <ScoreBadge band={catalogScore.band} />
              </div>
              {catalogScore.weakest && (
                <p className="text-sm text-neutral-500">
                  Weakest album:{" "}
                  <span className="font-medium text-neutral-700">
                    {albums.find((a) => a.id === catalogScore.weakest!.album_id)?.title ?? "—"}
                  </span>{" "}
                  — {catalogScore.weakest.score}%
                </p>
              )}
            </div>
            <ScoreProgressBar score={catalogScore.average} band={catalogScore.band} />
            <p className="text-xs text-neutral-500">{SCORE_FRAMING_NOTE}</p>
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-700">
            {albums.length} album{albums.length === 1 ? "" : "s"} · {tracks.length} track
            {tracks.length === 1 ? "" : "s"}
          </p>
          {albums.length === 0 ? (
            <p className="text-neutral-500">Run a check once you've confirmed an import.</p>
          ) : ready ? (
            <p className="font-medium text-emerald-700">
              ✓ Catalog ready for migration
              {warningCount > 0 &&
                ` (${warningCount} minor warning${warningCount === 1 ? "" : "s"} to review)`}
            </p>
          ) : (
            <p className="font-medium text-red-700">
              ✗ {errorCount} issue{errorCount === 1 ? "" : "s"} should be fixed before migration
              {warningCount > 0 && ` · ${warningCount} warning${warningCount === 1 ? "" : "s"}`}
            </p>
          )}
        </div>

        {albums.length === 0 ? (
          <p className="text-neutral-600">
            No confirmed albums yet.{" "}
            <Link href="/import" className="underline">
              Import one
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <ul className="space-y-4">
            {albums.map((album) => {
              const albumIssues = issuesByAlbum.get(album.id) ?? [];
              const albumErrorCount = albumIssues.filter((i) => i.severity === "error").length;
              const trackCount = trackCountByAlbum.get(album.id) ?? 0;
              const albumScore = albumScoreById.get(album.id);
              return (
                <li key={album.id} className="rounded-lg border border-neutral-200 bg-white p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {album.title}{" "}
                        <span className="font-normal text-neutral-500">— {album.artist}</span>
                      </p>
                      <p className="text-sm text-neutral-500">
                        {trackCount} track{trackCount === 1 ? "" : "s"}
                      </p>
                      {albumScore && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-700">
                            {albumScore.score}%
                          </span>
                          <ScoreBadge band={albumScore.band} />
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-sm">
                      {albumIssues.length === 0 ? (
                        <span className="text-emerald-700">✓ No issues</span>
                      ) : (
                        <span className={albumErrorCount > 0 ? "text-red-700" : "text-amber-700"}>
                          {albumIssues.length} issue{albumIssues.length === 1 ? "" : "s"}
                        </span>
                      )}
                      <Link
                        href={`/health/preflight?album_id=${album.id}`}
                        className="text-neutral-900 underline"
                      >
                        Preflight
                      </Link>
                      <GenerateReportButton albumId={album.id} label="Report" />
                      <Link href={`/albums/edit?id=${album.id}`} className="text-neutral-900 underline">
                        Edit
                      </Link>
                      <Link href={`/albums/attach?id=${album.id}`} className="text-neutral-900 underline">
                        Attach files
                      </Link>
                      <Link href={`/albums/export?id=${album.id}`} className="text-neutral-900 underline">
                        Export pack
                      </Link>
                      <DeleteAlbumButton albumId={album.id} title={album.title} />
                    </div>
                  </div>
                  {albumIssues.length > 0 && (
                    <ul className="mt-4 space-y-1 border-t border-neutral-100 pt-4">
                      {albumIssues.map((issue) => (
                        <li key={issue.id} className="flex items-start gap-2 text-sm">
                          <span
                            className={issue.severity === "error" ? "text-red-600" : "text-amber-600"}
                          >
                            {issue.severity === "error" ? "✗" : "⚠"}
                          </span>
                          <span className="text-neutral-700">{issue.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
