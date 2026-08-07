"use client";

import { useMemo, useState } from "react";
import type { Track } from "@/types/catalog";
import type { LocalAudioFile } from "@/lib/localAudio";
import {
  matchLocalAudioFiles,
  HIGH_CONFIDENCE_THRESHOLD,
  type MatchRunResult,
  type MatchProgress,
} from "@/lib/audioMatcher";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface SmartMatchPanelProps {
  tracks: Track[];
  folderFiles: LocalAudioFile[];
  audioRefs: Record<string, string | null>;
  onSave: (track: Track, reference: string | null) => Promise<void>;
}

type RunState = "idle" | "scanning" | "applying" | "done";

export default function SmartMatchPanel({
  tracks,
  folderFiles,
  audioRefs,
  onSave,
}: SmartMatchPanelProps) {
  const [runState, setRunState] = useState<RunState>("idle");
  const [progress, setProgress] = useState<MatchProgress | null>(null);
  const [result, setResult] = useState<MatchRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingTrackIds, setSavingTrackIds] = useState<Set<string>>(new Set());

  const unmatchedTracks = useMemo(
    () => tracks.filter((t) => !audioRefs[t.id]),
    [tracks, audioRefs]
  );

  if (tracks.length === 0) return null;

  async function runSmartMatch() {
    setError(null);
    setRunState("scanning");
    setProgress(null);
    try {
      const run = await matchLocalAudioFiles(folderFiles, unmatchedTracks, (p) => setProgress(p));
      setResult(run);
      setRunState("applying");
      for (const pair of run.auto) {
        await onSave(pair.track, pair.file.relativePath);
      }
      setRunState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Smart match failed.");
      setRunState("idle");
    }
  }

  async function undoAutoMatches() {
    if (!result) return;
    setRunState("applying");
    for (const pair of result.auto) {
      if (audioRefs[pair.track.id] === pair.file.relativePath) {
        await onSave(pair.track, null);
      }
    }
    setRunState("done");
  }

  async function useCandidate(track: Track, reference: string) {
    setSavingTrackIds((prev) => new Set(prev).add(track.id));
    try {
      await onSave(track, reference);
    } finally {
      setSavingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  }

  const stillAutoApplied = result?.auto.filter(
    (pair) => audioRefs[pair.track.id] === pair.file.relativePath
  );
  const pendingReview = result?.review.filter((item) => !audioRefs[item.track.id]) ?? [];
  const busy = runState === "scanning" || runState === "applying";

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink">Smart match</h2>
          <p className="text-xs text-ink/50">
            Fuzzy-matches your local filenames to track titles, using position and embedded tags
            as extra signals. High-confidence pairs save automatically; anything uncertain is
            queued below for you to confirm.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || unmatchedTracks.length === 0}
          onClick={runSmartMatch}
        >
          {runState === "scanning"
            ? "Scanning…"
            : runState === "applying"
              ? "Saving…"
              : "Run smart match"}
        </Button>
      </div>

      {unmatchedTracks.length === 0 && !result && (
        <p className="text-xs text-ink/50">All tracks already have audio verified.</p>
      )}

      {error && <p className="text-sm text-rust">{error}</p>}

      {runState === "scanning" && progress && progress.total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]">
            <div
              className="h-full rounded-full bg-brass transition-all duration-300"
              style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-ink/40">
            Reading file details… {progress.completed}/{progress.total}
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{result.auto.length} auto-matched</Badge>
            <Badge tone={pendingReview.length > 0 ? "warning" : "neutral"}>
              {pendingReview.length} need review
            </Badge>
          </div>

          {stillAutoApplied && stillAutoApplied.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-ink/70">Auto-matched</h3>
                <button
                  type="button"
                  disabled={busy}
                  onClick={undoAutoMatches}
                  className="text-xs text-ink/50 underline disabled:opacity-40"
                >
                  Undo all
                </button>
              </div>
              <ul className="space-y-1">
                {stillAutoApplied.map((pair) => (
                  <li
                    key={pair.track.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-ink/70">
                      {pair.track.position}. {pair.track.title} → {pair.file.relativePath}
                    </span>
                    <Badge tone="success">{Math.round(pair.score * 100)}%</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pendingReview.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-ink/70">Needs review</h3>
              <ul className="space-y-3">
                {pendingReview.map((item) => {
                  const saving = savingTrackIds.has(item.track.id);
                  return (
                    <li
                      key={item.track.id}
                      className="space-y-2 rounded-md border border-ink/10 p-3"
                    >
                      <p className="text-sm text-ink">
                        {item.track.position}. {item.track.title}
                      </p>
                      {item.candidates.length === 0 ? (
                        <p className="text-xs text-ink/40">
                          No confident match found — pick a file manually below.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {item.candidates.map((c) => (
                            <li
                              key={c.file.relativePath}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => useCandidate(item.track, c.file.relativePath)}
                                className="!px-3 !py-1.5 !text-xs"
                              >
                                Use &ldquo;{c.file.relativePath}&rdquo;
                              </Button>
                              <Badge tone={c.score >= HIGH_CONFIDENCE_THRESHOLD ? "success" : "warning"}>
                                {Math.round(c.score * 100)}%
                              </Badge>
                              {c.reasons.map((reason) => (
                                <span key={reason} className="text-[11px] text-ink/40">
                                  {reason}
                                </span>
                              ))}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
