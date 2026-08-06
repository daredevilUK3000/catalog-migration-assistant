import type { Credit, Track } from "@/types/catalog";

// Credit.role is freeform text, not a fixed enum — a substring match is the
// only non-guessing way to tell "no songwriter credit at all" apart from
// "has other credits (producer, performer) but not this one". Shared by
// lib/catalogHealth.ts (the missing_songwriter_credit check) and the
// bulk-apply endpoint, so both agree on what counts as "already credited".
export function isSongwriterCredit(credit: Credit): boolean {
  return credit.role.toLowerCase().includes("songwriter");
}

export function hasSongwriterCredit(track: Pick<Track, "credits">): boolean {
  return track.credits.some(isSongwriterCredit);
}
