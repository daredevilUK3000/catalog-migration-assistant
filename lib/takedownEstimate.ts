// Deterministic date math for the takedown countdown display — no AI, no
// guessing at a real distributor's actual processing time (which this app
// can't observe), just arithmetic over a user-supplied window.

export const DEFAULT_TAKEDOWN_MIN_DAYS = 14;
export const DEFAULT_TAKEDOWN_MAX_DAYS = 28;

export interface TakedownEstimate {
  elapsedDays: number;
  remainingMinDays: number;
  remainingMaxDays: number;
  /** Elapsed time has passed the max end of the window — still not
   * "cleared" without the user manually confirming it, just worth a nudge
   * to check in with the distributor. */
  overdue: boolean;
}

export function estimateTakedown(
  requestedAt: string,
  minDays: number,
  maxDays: number
): TakedownEstimate {
  const elapsedMs = Date.now() - new Date(requestedAt).getTime();
  const elapsedDays = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
  const remainingMinDays = Math.max(0, minDays - elapsedDays);
  const remainingMaxDays = Math.max(0, maxDays - elapsedDays);
  return { elapsedDays, remainingMinDays, remainingMaxDays, overdue: elapsedDays > maxDays };
}

/** Human-readable line for a table row, e.g. "Requested 12 days ago —
 * likely clears in ~9-16 days" or "...— past the typical window, worth
 * checking in" once overdue. */
export function formatTakedownEstimate(estimate: TakedownEstimate): string {
  const { elapsedDays, remainingMinDays, remainingMaxDays, overdue } = estimate;
  const elapsedLabel = elapsedDays === 1 ? "1 day ago" : `${elapsedDays} days ago`;

  if (overdue) {
    return `Requested ${elapsedLabel} — past the typical window, worth checking in with the distributor`;
  }
  if (remainingMinDays === 0 && remainingMaxDays === 0) {
    return `Requested ${elapsedLabel} — could clear any time now`;
  }
  if (remainingMinDays === remainingMaxDays) {
    return `Requested ${elapsedLabel} — likely clears in ~${remainingMaxDays} day${remainingMaxDays === 1 ? "" : "s"}`;
  }
  return `Requested ${elapsedLabel} — likely clears in ~${remainingMinDays}–${remainingMaxDays} days`;
}
