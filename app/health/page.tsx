import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { isPremiumUserId } from "@/lib/auth/premium";
import type { Album, CatalogIssue } from "@/types/catalog";
import { computeCatalogScore, SCORE_FRAMING_NOTE } from "@/lib/migrationScore";
import { ScoreBadge, ScoreProgressBar } from "./scoreDisplay";
import RunHealthCheckButton from "./RunHealthCheckButton";
import SetDefaultSongwriterPanel from "./SetDefaultSongwriterPanel";
import DeleteAlbumButton from "./DeleteAlbumButton";
import GenerateReportButton from "./GenerateReportButton";
import DownloadBackupButton from "./DownloadBackupButton";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import PremiumTag from "@/components/ui/PremiumTag";
import EmptyState from "@/components/ui/EmptyState";

// Visually matches <Button variant="secondary"> without actually being a
// <button> — this is a real navigation link (Next.js Link), and Button
// only renders a <button> element, so wrapping it would either lose proper
// anchor semantics or nest an interactive element inside another.
const LINK_BUTTON_SECONDARY =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors bg-transparent border border-ink/20 text-ink hover:bg-ink/[0.04] hover:border-ink/35";

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
  const allAlbums = (albumRows ?? []) as Album[];

  // Full multi-album catalog health/score is a premium action — a
  // non-premium user only sees their most recently added album, gated
  // server-side (not just hidden), same discipline as Export Pack and the
  // Migration Report PDF.
  const isPremium = await isPremiumUserId(userId);
  const albums = isPremium ? allAlbums : allAlbums.slice(0, 1);
  const catalogLocked = !isPremium && allAlbums.length > albums.length;
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
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <PageHeader
          title="Catalog health"
          description="Deterministic checks against your confirmed catalog — no AI involved."
          actions={
            <>
              <Link href="/health/preflight" className={LINK_BUTTON_SECONDARY}>
                Preflight check
              </Link>
              {albums.length > 0 && (
                <span className="inline-flex items-center">
                  <GenerateReportButton label="Generate report" />
                  <PremiumTag unlocked={isPremium} />
                </span>
              )}
              {albums.length > 0 && <DownloadBackupButton />}
              {albums.length > 0 && (
                <span className="inline-flex items-center">
                  <SetDefaultSongwriterPanel scope="catalog" />
                  <PremiumTag unlocked={isPremium} />
                </span>
              )}
              <RunHealthCheckButton />
            </>
          }
        />

        {catalogLocked && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-brass/30 bg-brass/[0.06] p-4">
            <p className="text-sm text-ink/70">
              Showing health for 1 of {allAlbums.length} albums. Unlock full catalog health and
              scoring across every album with Own Your Music.
            </p>
            <Link href="/billing" className={LINK_BUTTON_SECONDARY}>
              Unlock on /billing
            </Link>
          </Card>
        )}

        {isPremium && allAlbums.length > 1 && (
          <p className="flex items-center gap-2 text-xs text-ink/50">
            <PremiumTag unlocked />
            Full catalog health across all {allAlbums.length} albums — included in your purchase.
          </p>
        )}

        {albums.length > 0 && (
          <Card className="space-y-3 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold text-ink">{catalogScore.average}%</span>
                <ScoreBadge band={catalogScore.band} />
              </div>
              {catalogScore.weakest && (
                <p className="text-sm text-ink/50">
                  Weakest album:{" "}
                  <span className="font-medium text-ink/70">
                    {albums.find((a) => a.id === catalogScore.weakest!.album_id)?.title ?? "—"}
                  </span>{" "}
                  — {catalogScore.weakest.score}%
                </p>
              )}
            </div>
            <ScoreProgressBar score={catalogScore.average} band={catalogScore.band} />
            <p className="text-xs text-ink/50">{SCORE_FRAMING_NOTE}</p>
          </Card>
        )}

        <Card className="space-y-2 p-6">
          <p className="text-sm text-ink/70">
            {albums.length} album{albums.length === 1 ? "" : "s"} · {tracks.length} track
            {tracks.length === 1 ? "" : "s"}
          </p>
          {albums.length === 0 ? (
            <p className="text-ink/50">Run a check once you've confirmed an import.</p>
          ) : ready ? (
            <div className="flex items-center gap-2">
              <Badge tone="success">Ready</Badge>
              <span className="text-sm text-ink/70">
                Catalog ready for migration
                {warningCount > 0 &&
                  ` (${warningCount} minor warning${warningCount === 1 ? "" : "s"} to review)`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge tone="danger">Not ready</Badge>
              <span className="text-sm text-ink/70">
                {errorCount} issue{errorCount === 1 ? "" : "s"} should be fixed before migration
                {warningCount > 0 && ` · ${warningCount} warning${warningCount === 1 ? "" : "s"}`}
              </span>
            </div>
          )}
        </Card>

        {albums.length === 0 ? (
          <EmptyState
            message="No confirmed albums yet."
            action={
              <Link href="/import" className={LINK_BUTTON_SECONDARY}>
                Import one
              </Link>
            }
          />
        ) : (
          <ul className="space-y-4">
            {albums.map((album) => {
              const albumIssues = issuesByAlbum.get(album.id) ?? [];
              const albumErrorCount = albumIssues.filter((i) => i.severity === "error").length;
              const trackCount = trackCountByAlbum.get(album.id) ?? 0;
              const albumScore = albumScoreById.get(album.id);
              return (
                <li key={album.id}>
                  <Card className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-ink">
                          {album.title} <span className="font-normal text-ink/50">— {album.artist}</span>
                        </p>
                        <p className="text-sm text-ink/50">
                          {trackCount} track{trackCount === 1 ? "" : "s"}
                        </p>
                        {albumScore && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm font-medium text-ink/70">{albumScore.score}%</span>
                            <ScoreBadge band={albumScore.band} />
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-sm">
                        {albumIssues.length === 0 ? (
                          <span className="text-brass">✓ No issues</span>
                        ) : (
                          <span className={albumErrorCount > 0 ? "text-rust" : "text-rust/70"}>
                            {albumIssues.length} issue{albumIssues.length === 1 ? "" : "s"}
                          </span>
                        )}
                        <Link
                          href={`/health/preflight?album_id=${album.id}`}
                          className="text-ink underline hover:text-brass"
                        >
                          Preflight
                        </Link>
                        <span className="inline-flex items-center">
                          <GenerateReportButton albumId={album.id} label="Report" />
                          <PremiumTag unlocked={isPremium} />
                        </span>
                        <Link
                          href={`/albums/edit?id=${album.id}`}
                          className="text-ink underline hover:text-brass"
                        >
                          Edit
                        </Link>
                        <SetDefaultSongwriterPanel scope="album" albumId={album.id} compact />
                        <Link
                          href={`/albums/attach?id=${album.id}`}
                          className="text-ink underline hover:text-brass"
                        >
                          Attach files
                        </Link>
                        <span className="inline-flex items-center">
                          <Link
                            href={`/albums/export?id=${album.id}`}
                            className="text-ink underline hover:text-brass"
                          >
                            Export pack
                          </Link>
                          <PremiumTag unlocked={isPremium} />
                        </span>
                        <DeleteAlbumButton albumId={album.id} title={album.title} trackCount={trackCount} />
                      </div>
                    </div>
                    {albumIssues.length > 0 && (
                      <ul className="mt-4 space-y-1 border-t border-ink/10 pt-4">
                        {albumIssues.map((issue) => (
                          <li key={issue.id} className="flex items-start gap-2 text-sm">
                            <span className={issue.severity === "error" ? "text-rust" : "text-rust/70"}>
                              {issue.severity === "error" ? "✗" : "⚠"}
                            </span>
                            <span className="text-ink/70">{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
