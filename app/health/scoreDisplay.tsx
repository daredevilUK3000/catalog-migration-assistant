import type { ScoreBand } from "@/lib/migrationScore";
import { BAND_LABEL } from "@/lib/migrationScore";

// Shared, no "use client" needed — pure presentational pieces used by both
// the server-rendered /health dashboard and the client-side Preflight
// animation.

export function bandColors(band: ScoreBand): { text: string; bg: string; bar: string } {
  switch (band) {
    case "ready":
      return { text: "text-emerald-700", bg: "bg-emerald-50", bar: "bg-emerald-500" };
    case "needs_attention":
      return { text: "text-amber-700", bg: "bg-amber-50", bar: "bg-amber-500" };
    case "not_ready":
      return { text: "text-red-700", bg: "bg-red-50", bar: "bg-red-500" };
  }
}

export function ScoreBadge({ band }: { band: ScoreBand }) {
  const colors = bandColors(band);
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colors.bg} ${colors.text}`}
    >
      {BAND_LABEL[band]}
    </span>
  );
}

export function ScoreProgressBar({ score, band }: { score: number; band: ScoreBand }) {
  const colors = bandColors(band);
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
      <div
        className={`h-full rounded-full ${colors.bar} transition-all duration-700 ease-out`}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}
