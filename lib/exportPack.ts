import type { Album, Track, Credit, DistributorProfile, DistributorExportField } from "@/types/catalog";

export interface ExportRow {
  label: string;
  value: string;
}

/** Album-level fields render once; each track gets its own row set. */
export interface TrackExportSection {
  track: Track;
  rows: ExportRow[];
}

/** One page of the distributor's real submission flow (e.g. Ditto's
 * "Details" vs "Schedule" step) — or a catch-all for fields whose real page
 * isn't verified yet. Grouping this way, rather than one flat list, is what
 * makes the sheet actually mirror a multi-step distributor form. */
export interface AlbumExportSection {
  step: string;
  rows: ExportRow[];
}

export interface ExportPack {
  albumSections: AlbumExportSection[];
  trackSections: TrackExportSection[];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatCredits(credits: Credit[]): string {
  if (!credits || credits.length === 0) return "";
  return credits
    .map((c) => `${c.role}: ${c.name}${c.split_percent != null ? ` (${c.split_percent}%)` : ""}`)
    .join("; ");
}

/** `source` is a key path per DistributorExportField's convention — a bare
 * key resolves against the album, a "track."-prefixed key against the track. */
function resolveField(field: DistributorExportField, album: Album, track: Track | null): string {
  const source = field.source;
  if (source.startsWith("track.")) {
    if (!track) return "";
    const key = source.slice("track.".length);
    if (key === "credits") return formatCredits(track.credits);
    return formatValue((track as unknown as Record<string, unknown>)[key]);
  }
  return formatValue((album as unknown as Record<string, unknown>)[source]);
}

export function buildExportPack(profile: DistributorProfile, album: Album, tracks: Track[]): ExportPack {
  const fields = profile.export_field_map.fields ?? [];
  const albumFields = fields.filter((f) => !f.source.startsWith("track."));
  const trackFields = fields.filter((f) => f.source.startsWith("track."));

  // Group by step in first-seen order — preserves the field order within
  // each step and the order steps were first encountered, matching how the
  // fields were laid out in export_field_map.
  const stepOrder: string[] = [];
  const rowsByStep = new Map<string, ExportRow[]>();
  for (const f of albumFields) {
    const step = f.step ?? "Other";
    if (!rowsByStep.has(step)) {
      rowsByStep.set(step, []);
      stepOrder.push(step);
    }
    rowsByStep.get(step)!.push({ label: f.label, value: resolveField(f, album, null) });
  }
  const albumSections = stepOrder.map((step) => ({ step, rows: rowsByStep.get(step)! }));

  const sortedTracks = [...tracks].sort((a, b) => a.position - b.position);
  const trackSections = sortedTracks.map((track) => ({
    track,
    rows: trackFields.map((f) => ({ label: f.label, value: resolveField(f, album, track) })),
  }));

  return { albumSections, trackSections };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** One row per track, with album-level fields repeated on every row — the
 * common flat shape bulk metadata CSV importers expect. */
export function buildExportCsv(profile: DistributorProfile, album: Album, tracks: Track[]): string {
  const fields = profile.export_field_map.fields ?? [];
  const header = fields.map((f) => csvEscape(f.label)).join(",");

  const sortedTracks = [...tracks].sort((a, b) => a.position - b.position);
  const rows = sortedTracks.map((track) =>
    fields.map((f) => csvEscape(resolveField(f, album, track))).join(",")
  );

  return [header, ...rows].join("\r\n");
}
