// Client-side fuzzy matcher pairing local audio files (picked via the File
// System Access API, see lib/localAudio.ts) to a confirmed album's tracks.
// Nothing here uploads or transmits anything — matching runs entirely in the
// browser against filenames, in-memory track titles, and small header reads
// of the local files themselves (lib/audioFileHeaders.ts).
//
// Signal priority, per the feature spec:
//   1. Filename-vs-title fuzzy match (primary)
//   2. Leading track-number prefix alignment (secondary, strong prior)
//   3. Embedded WAV/FLAC tag metadata, where present (tertiary bonus, never required)
//   4. File duration — a sanity check / near-tie breaker only, never a primary key
//
// Nothing auto-pairs below a clear confidence bar: matchLocalAudioFiles()
// always returns both an `auto` list (safe to save immediately) and a
// `review` list (needs a human to confirm or reassign).

import Fuse from "fuse.js";
import type { LocalAudioFile } from "@/lib/localAudio";
import type { Track } from "@/types/catalog";
import { getAudioFileInfo } from "@/lib/audioFileHeaders";

export const HIGH_CONFIDENCE_THRESHOLD = 0.75;
export const AMBIGUITY_MARGIN = 0.12;
export const MIN_CANDIDATE_FLOOR = 0.35;
export const CANDIDATES_PER_TRACK = 6;
export const REVIEW_CANDIDATES_SHOWN = 3;
export const DURATION_OUTLIER_RATIO = 0.2;

// Filename is the primary signal (per spec) and must be able to clear the
// confidence bar on its own for an unambiguous exact match — position and
// metadata are boosts on top of it, not requirements for confidence.
const WEIGHT_FILENAME = 0.8;
const POSITION_EXACT_BONUS = 0.2;
const POSITION_NEAR_BONUS = 0.07;
const METADATA_TITLE_BONUS = 0.15;
const METADATA_TRACKNUMBER_BONUS = 0.07;
const DURATION_CLOSENESS_WEIGHT = 0.05;
const DURATION_OUTLIER_PENALTY = 0.5;

const CHUNK_YIELD_EVERY = 20;

export interface ScoredCandidate {
  file: LocalAudioFile;
  score: number;
  reasons: string[];
  durationSeconds: number | null;
}

export interface MatchPair {
  track: Track;
  file: LocalAudioFile;
  score: number;
  reasons: string[];
}

export interface ReviewItem {
  track: Track;
  candidates: ScoredCandidate[];
}

export interface MatchRunResult {
  auto: MatchPair[];
  review: ReviewItem[];
}

export interface MatchProgress {
  phase: "headers";
  completed: number;
  total: number;
}

const NOISE_WORDS = new Set([
  "final",
  "master",
  "mastered",
  "mix",
  "mixdown",
  "version",
  "ver",
  "edit",
  "copy",
  "track",
]);

/** Strips extension/separators/noise words so a messy filename and a clean
 * track title compare on roughly the same footing. Leading track numbers are
 * stripped here too — extractLeadingPosition() reads them separately. */
export function normalizeForMatch(input: string): string {
  const withoutExt = input.replace(/\.[a-z0-9]{2,4}$/i, "");
  const spaced = withoutExt.replace(/[_\-.]+/g, " ");
  const withoutLeadingNumber = spaced.replace(/^\s*\(?0*\d{1,3}\)?[\s.\-_]*/, " ");
  const words = withoutLeadingNumber
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w) && !/^v\d+$/.test(w));
  return words.join(" ").trim();
}

/** Parses a leading track-number prefix ("01_", "Track 02 - ", "(3) "). */
export function extractLeadingPosition(filename: string): number | null {
  const withoutExt = filename.replace(/\.[a-z0-9]{2,4}$/i, "");
  const match = withoutExt.match(/^[^\d]{0,12}0*(\d{1,3})(?!\d)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}

function wordSetSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeForMatch(a).split(" ").filter(Boolean));
  const wb = new Set(normalizeForMatch(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersect = 0;
  for (const w of wa) if (wb.has(w)) intersect++;
  return intersect / Math.max(wa.size, wb.size);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

interface IndexedFile {
  file: LocalAudioFile;
  normalized: string;
}

function buildFuseIndex(files: LocalAudioFile[]): Fuse<IndexedFile> {
  const indexed: IndexedFile[] = files.map((file) => ({
    file,
    normalized: normalizeForMatch(file.name),
  }));
  return new Fuse(indexed, {
    keys: ["normalized"],
    includeScore: true,
    ignoreLocation: true,
    distance: 200,
    threshold: 1.0, // don't let Fuse's own cutoff hide candidates — we threshold ourselves
  });
}

interface PreliminaryCandidate {
  track: Track;
  file: LocalAudioFile;
  filenameSim: number;
  score: number; // running composite, refined as later signals are added
  reasons: string[];
}

function filenameCandidatesForTrack(
  fuse: Fuse<IndexedFile>,
  track: Track
): { file: LocalAudioFile; filenameSim: number }[] {
  const query = normalizeForMatch(track.title) || track.title.toLowerCase().trim();
  if (!query) return [];
  return fuse
    .search(query, { limit: CANDIDATES_PER_TRACK })
    .map((r) => ({ file: r.item.file, filenameSim: 1 - (r.score ?? 1) }));
}

function scorePosition(file: LocalAudioFile, track: Track, reasons: string[]): number {
  const leading = extractLeadingPosition(file.name);
  if (leading === null) return 0;
  if (leading === track.position) {
    reasons.push("Track number aligns");
    return POSITION_EXACT_BONUS;
  }
  if (Math.abs(leading - track.position) === 1) {
    reasons.push("Track number close");
    return POSITION_NEAR_BONUS;
  }
  return 0;
}

async function yieldToUi(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Runs the full matching pipeline for one album's tracks against the local
 * files found in the picked folder. Safe to call with up to ~750 files:
 * header reads (the only slow part) are bounded to the shortlisted candidate
 * set, not every file, and that set is processed in small chunks with UI
 * thread yields in between.
 */
export async function matchLocalAudioFiles(
  files: LocalAudioFile[],
  tracks: Track[],
  onProgress?: (progress: MatchProgress) => void
): Promise<MatchRunResult> {
  if (tracks.length === 0 || files.length === 0) {
    return { auto: [], review: tracks.map((track) => ({ track, candidates: [] })) };
  }

  const fuse = buildFuseIndex(files);

  // Pass 1 — cheap filename-only shortlist per track.
  const preliminary: PreliminaryCandidate[] = [];
  for (const track of tracks) {
    for (const { file, filenameSim } of filenameCandidatesForTrack(fuse, track)) {
      const reasons: string[] = [];
      if (filenameSim > 0) reasons.push(`Filename ${Math.round(filenameSim * 100)}% match`);
      const positionBonus = scorePosition(file, track, reasons);
      preliminary.push({
        track,
        file,
        filenameSim,
        score: clamp01(filenameSim * WEIGHT_FILENAME + positionBonus),
        reasons,
      });
    }
  }

  // Pass 2 — read headers only for files that showed up as a candidate.
  const candidateFiles = new Map<string, LocalAudioFile>();
  for (const c of preliminary) candidateFiles.set(c.file.relativePath, c.file);
  const headerInfo = new Map<string, Awaited<ReturnType<typeof getAudioFileInfo>>>();

  const toRead = Array.from(candidateFiles.values());
  for (let i = 0; i < toRead.length; i++) {
    const localFile = toRead[i];
    try {
      const nativeFile = await localFile.handle.getFile();
      headerInfo.set(localFile.relativePath, await getAudioFileInfo(nativeFile));
    } catch {
      headerInfo.set(localFile.relativePath, {
        durationSeconds: null,
        embeddedTitle: null,
        embeddedTrackNumber: null,
      });
    }
    onProgress?.({ phase: "headers", completed: i + 1, total: toRead.length });
    if ((i + 1) % CHUNK_YIELD_EVERY === 0) await yieldToUi();
  }

  // Metadata bonus, using header info now available.
  for (const c of preliminary) {
    const info = headerInfo.get(c.file.relativePath);
    if (!info) continue;
    let metadataBonus = 0;
    if (info.embeddedTitle && wordSetSimilarity(info.embeddedTitle, c.track.title) > 0.6) {
      metadataBonus += METADATA_TITLE_BONUS;
      c.reasons.push("Title tag matches");
    }
    if (info.embeddedTrackNumber !== null && info.embeddedTrackNumber === c.track.position) {
      metadataBonus += METADATA_TRACKNUMBER_BONUS;
      c.reasons.push("Track # tag matches");
    }
    c.score = clamp01(c.score + metadataBonus);
  }

  // Duration — sanity check + near-tie breaker, never a primary signal.
  // "Expected" length comes from the album's own provisionally-strong
  // matches, since the catalog doesn't store an authoritative duration.
  const provisionalDurations: number[] = [];
  for (const c of preliminary) {
    const duration = headerInfo.get(c.file.relativePath)?.durationSeconds;
    if (duration && c.score >= HIGH_CONFIDENCE_THRESHOLD) provisionalDurations.push(duration);
  }
  const expectedDuration = median(provisionalDurations);

  for (const c of preliminary) {
    const duration = headerInfo.get(c.file.relativePath)?.durationSeconds ?? null;
    if (duration === null || expectedDuration === null || expectedDuration <= 0) continue;
    const ratio = duration / expectedDuration;
    if (ratio < DURATION_OUTLIER_RATIO) {
      c.score = clamp01(c.score * DURATION_OUTLIER_PENALTY);
      c.reasons.push("Duration looks short for this track");
    } else {
      const closeness = clamp01(1 - Math.abs(duration - expectedDuration) / expectedDuration);
      c.score = clamp01(c.score + closeness * DURATION_CLOSENESS_WEIGHT);
    }
  }

  // Greedy 1:1 assignment, highest composite score first.
  const sorted = [...preliminary].sort((a, b) => b.score - a.score);
  const assignedTrack = new Map<string, PreliminaryCandidate>();
  const assignedFile = new Set<string>();
  for (const c of sorted) {
    if (assignedTrack.has(c.track.id) || assignedFile.has(c.file.relativePath)) continue;
    assignedTrack.set(c.track.id, c);
    assignedFile.add(c.file.relativePath);
  }

  // Build per-track candidate lists (deduped, best first) for the review queue.
  const candidatesByTrack = new Map<string, PreliminaryCandidate[]>();
  for (const c of preliminary) {
    const list = candidatesByTrack.get(c.track.id) ?? [];
    list.push(c);
    candidatesByTrack.set(c.track.id, list);
  }
  for (const list of candidatesByTrack.values()) {
    list.sort((a, b) => b.score - a.score);
  }

  const auto: MatchPair[] = [];
  const review: ReviewItem[] = [];

  for (const track of tracks) {
    const assigned = assignedTrack.get(track.id);
    const trackCandidates = candidatesByTrack.get(track.id) ?? [];
    const runnerUp = trackCandidates.find((c) => c.file.relativePath !== assigned?.file.relativePath);

    const isHighConfidence =
      assigned !== undefined &&
      assigned.score >= HIGH_CONFIDENCE_THRESHOLD &&
      assigned.score - (runnerUp?.score ?? 0) >= AMBIGUITY_MARGIN;

    if (assigned && isHighConfidence) {
      auto.push({ track, file: assigned.file, score: assigned.score, reasons: assigned.reasons });
      continue;
    }

    const reviewCandidates: ScoredCandidate[] = trackCandidates
      .filter((c) => c.score >= MIN_CANDIDATE_FLOOR)
      .slice(0, REVIEW_CANDIDATES_SHOWN)
      .map((c) => ({
        file: c.file,
        score: c.score,
        reasons: c.reasons,
        durationSeconds: headerInfo.get(c.file.relativePath)?.durationSeconds ?? null,
      }));

    review.push({ track, candidates: reviewCandidates });
  }

  return { auto, review };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
