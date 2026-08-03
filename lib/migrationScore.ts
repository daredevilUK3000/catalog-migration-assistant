import type { Album, CatalogIssue, IssueType } from "@/types/catalog";

// Migration Confidence Score — a scoring layer over the existing
// catalog_issues data. Deliberately kept separate from the `severity`
// (warning/error) field on CatalogIssue: severity drives the older /health
// error/warning chips, while this is a distinct three-tier weighting the
// product spec calls for. Nothing here re-derives catalog_issues rows —
// see lib/catalogHealth.ts for that.

export type ScoreTier = "critical" | "important" | "minor";
export type ScoreBand = "ready" | "needs_attention" | "not_ready";

export const BAND_LABEL: Record<ScoreBand, string> = {
  ready: "Ready to Migrate",
  needs_attention: "Needs Attention",
  not_ready: "Not Ready",
};

/** How data readiness is measured — never claims to guarantee migration
 * outcomes, since that depends on how the destination DSP handles the
 * switch on its own end, which this tool can't see in advance. */
export const SCORE_FRAMING_NOTE =
  "This measures whether your catalog data is complete and internally consistent — it can't guarantee how Spotify, Apple Music, or other platforms will handle the migration once it reaches them.";

interface ScoringRule {
  tier: ScoreTier;
  points: number;
  per: "track" | "pair" | "album";
}

// Exactly the spec's deduction table. likely_duplicate_album has no entry —
// it's a catalog-hygiene warning (repeat import), not a migration-readiness
// signal, so it carries no point deduction.
const ISSUE_SCORING: Partial<Record<IssueType, ScoringRule>> = {
  missing_isrc: { tier: "critical", points: 6, per: "track" },
  duplicate_isrc: { tier: "critical", points: 8, per: "pair" },
  missing_audio_file: { tier: "critical", points: 6, per: "track" },
  track_count_mismatch: { tier: "critical", points: 15, per: "album" },
  artwork_too_small: { tier: "important", points: 5, per: "album" },
  missing_release_date: { tier: "important", points: 4, per: "album" },
  missing_upc: { tier: "important", points: 4, per: "album" },
  missing_lyrics: { tier: "minor", points: 1, per: "track" },
  missing_songwriter_credit: { tier: "minor", points: 1, per: "track" },
};

export interface ScoreBreakdownEntry {
  issue_type: IssueType;
  tier: ScoreTier;
  count: number; // units deducted for: distinct tracks, pairs, or 1 (flat)
  points: number; // total points removed for this issue_type
}

export interface AlbumScore {
  album_id: string;
  score: number;
  band: ScoreBand;
  hasCriticalIssue: boolean;
  breakdown: ScoreBreakdownEntry[];
}

export interface CatalogScore {
  albums: AlbumScore[];
  average: number;
  weakest: AlbumScore | null;
  band: ScoreBand;
}

function bandFor(score: number): ScoreBand {
  if (score >= 95) return "ready";
  if (score >= 80) return "needs_attention";
  return "not_ready";
}

export function computeAlbumScore(albumId: string, albumIssues: CatalogIssue[]): AlbumScore {
  const byType = new Map<IssueType, CatalogIssue[]>();
  for (const issue of albumIssues) {
    if (issue.resolved) continue;
    const list = byType.get(issue.issue_type) ?? [];
    list.push(issue);
    byType.set(issue.issue_type, list);
  }

  let deducted = 0;
  let hasCriticalIssue = false;
  const breakdown: ScoreBreakdownEntry[] = [];

  for (const [issueType, rule] of Object.entries(ISSUE_SCORING) as [IssueType, ScoringRule][]) {
    const findings = byType.get(issueType);
    if (!findings || findings.length === 0) continue;

    if (rule.tier === "critical") hasCriticalIssue = true;

    let units: number;
    if (rule.per === "track") {
      units = new Set(findings.map((f) => f.track_id)).size;
    } else if (rule.per === "pair") {
      // checkDuplicateIsrcs stores one finding per affected track, not one
      // per collision — approximated here as floor(tracks / 2). Exact for
      // the common 2-track collision; a slight undercount for a rare
      // 3+-way collision on a single ISRC.
      units = Math.floor(new Set(findings.map((f) => f.track_id)).size / 2);
    } else {
      units = 1; // flat, album-level — presence alone triggers the deduction
    }

    if (units <= 0) continue;
    const points = units * rule.points;
    deducted += points;
    breakdown.push({ issue_type: issueType, tier: rule.tier, count: units, points });
  }

  // Layer 1: weighted deduction, floored at 0.
  let score = Math.max(0, 100 - deducted);
  // Layer 2: blocking cap — any unresolved Critical issue caps the album at
  // 79 regardless of how favorable the weighted math looks.
  if (hasCriticalIssue) score = Math.min(score, 79);

  return { album_id: albumId, score, band: bandFor(score), hasCriticalIssue, breakdown };
}

export function computeCatalogScore(albums: Album[], issues: CatalogIssue[]): CatalogScore {
  const issuesByAlbum = new Map<string, CatalogIssue[]>();
  for (const issue of issues) {
    if (issue.resolved) continue;
    const list = issuesByAlbum.get(issue.album_id) ?? [];
    list.push(issue);
    issuesByAlbum.set(issue.album_id, list);
  }

  const albumScores = albums.map((a) => computeAlbumScore(a.id, issuesByAlbum.get(a.id) ?? []));

  if (albumScores.length === 0) {
    return { albums: [], average: 0, weakest: null, band: "not_ready" };
  }

  const average = Math.round(
    albumScores.reduce((sum, a) => sum + a.score, 0) / albumScores.length
  );
  const weakest = albumScores.reduce((min, a) => (a.score < min.score ? a : min), albumScores[0]);

  return { albums: albumScores, average, weakest, band: bandFor(average) };
}

export interface PreflightStep {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

function pluralize(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}

function findingsOf(issues: CatalogIssue[], types: IssueType[]): CatalogIssue[] {
  return issues.filter((i) => !i.resolved && types.includes(i.issue_type));
}

/** Presentation-only step list for the animated Preflight view — built from
 * the same unresolved catalog_issues used for scoring, in the sequential
 * order the checklist "runs" in. Works for a single album or a whole
 * catalog: pass the relevant album count / track count / issue set. */
export function buildPreflightSteps(
  albumCount: number,
  trackCount: number,
  issues: CatalogIssue[]
): PreflightStep[] {
  const trackMismatches = findingsOf(issues, ["track_count_mismatch"]);
  const missingIsrc = findingsOf(issues, ["missing_isrc"]);
  const dupeIsrc = findingsOf(issues, ["duplicate_isrc"]);
  const isrcIssues = missingIsrc.length + dupeIsrc.length;
  const upcIssues = findingsOf(issues, ["missing_upc"]);
  const artworkIssues = findingsOf(issues, ["artwork_too_small"]);
  const audioIssues = findingsOf(issues, ["missing_audio_file"]);
  const metadataIssues = findingsOf(issues, ["missing_release_date", "likely_duplicate_album"]);
  const lyricsIssues = findingsOf(issues, ["missing_lyrics"]);
  const creditsIssues = findingsOf(issues, ["missing_songwriter_credit"]);

  return [
    {
      key: "albums",
      label: "Album count",
      ok: albumCount > 0,
      detail: albumCount > 0 ? `${pluralize(albumCount, "album")} found` : "No albums found",
    },
    {
      key: "tracks",
      label: "Track count",
      ok: trackMismatches.length === 0,
      detail:
        trackMismatches.length === 0
          ? `${pluralize(trackCount, "track")} accounted for`
          : `${pluralize(trackMismatches.length, "album")} with a tracklist gap`,
    },
    {
      key: "isrc",
      label: "ISRCs",
      ok: isrcIssues === 0,
      detail:
        isrcIssues === 0
          ? "All tracks have a unique ISRC"
          : [
              missingIsrc.length > 0 ? `${pluralize(missingIsrc.length, "track")} missing one` : null,
              dupeIsrc.length > 0 ? `${pluralize(dupeIsrc.length, "track")} duplicated` : null,
            ]
              .filter(Boolean)
              .join(", "),
    },
    {
      key: "upc",
      label: "UPCs",
      ok: upcIssues.length === 0,
      detail:
        upcIssues.length === 0
          ? "All albums have a UPC"
          : `${pluralize(upcIssues.length, "album")} missing a UPC`,
    },
    {
      key: "artwork",
      label: "Artwork",
      ok: artworkIssues.length === 0,
      detail:
        artworkIssues.length === 0
          ? "All artwork meets resolution requirements"
          : `${pluralize(artworkIssues.length, "album")} with missing/undersized artwork`,
    },
    {
      key: "audio",
      label: "Audio files",
      ok: audioIssues.length === 0,
      detail:
        audioIssues.length === 0
          ? "All tracks have audio attached"
          : `${pluralize(audioIssues.length, "track")} missing audio`,
    },
    {
      key: "metadata",
      label: "Metadata consistency",
      ok: metadataIssues.length === 0,
      detail:
        metadataIssues.length === 0
          ? "Release dates and album records look consistent"
          : `${pluralize(metadataIssues.length, "inconsistency", "inconsistencies")} found`,
    },
    {
      key: "lyrics",
      label: "Lyrics",
      ok: lyricsIssues.length === 0,
      detail:
        lyricsIssues.length === 0
          ? "All tracks have lyrics on file"
          : `${pluralize(lyricsIssues.length, "track")} missing lyrics`,
    },
    {
      key: "credits",
      label: "Songwriter credits",
      ok: creditsIssues.length === 0,
      detail:
        creditsIssues.length === 0
          ? "All tracks have a songwriter credit"
          : `${pluralize(creditsIssues.length, "track")} missing a songwriter credit`,
    },
  ];
}
