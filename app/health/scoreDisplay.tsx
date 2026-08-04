import type { ScoreBand } from "@/lib/migrationScore";
import { BAND_LABEL } from "@/lib/migrationScore";
import Badge from "@/components/ui/Badge";

// Shared, no "use client" needed — pure presentational pieces used by both
// the server-rendered /health dashboard and the client-side Preflight
// animation.

function bandTone(band: ScoreBand): "success" | "warning" | "danger" {
  switch (band) {
    case "ready":
      return "success";
    case "needs_attention":
      return "warning";
    case "not_ready":
      return "danger";
  }
}

function bandBarColor(band: ScoreBand): string {
  switch (band) {
    case "ready":
      return "bg-brass";
    case "needs_attention":
      return "bg-rust/70";
    case "not_ready":
      return "bg-rust";
  }
}

export function ScoreBadge({ band }: { band: ScoreBand }) {
  return <Badge tone={bandTone(band)}>{BAND_LABEL[band]}</Badge>;
}

export function ScoreProgressBar({ score, band }: { score: number; band: ScoreBand }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
      <div
        className={`h-full rounded-full ${bandBarColor(band)} transition-all duration-700 ease-out`}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}
