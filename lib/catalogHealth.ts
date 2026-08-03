import { imageSize } from "image-size";
import type { Album, Track, IssueType, IssueSeverity } from "@/types/catalog";

// Common minimum most DSPs will accept without a manual rejection.
export const MIN_ARTWORK_DIMENSION = 3000;

export interface IssueFinding {
  album_id: string;
  track_id: string | null;
  issue_type: IssueType;
  severity: IssueSeverity;
  message: string;
}

/** Identifies a specific problem instance — used to diff findings against
 * already-stored catalog_issues rows so re-running is idempotent. */
export function findingKey(f: Pick<IssueFinding, "album_id" | "track_id" | "issue_type">): string {
  return `${f.album_id}:${f.track_id ?? ""}:${f.issue_type}`;
}

function checkAlbumFields(album: Album, tracks: Track[]): IssueFinding[] {
  const findings: IssueFinding[] = [];

  if (!album.release_date) {
    findings.push({
      album_id: album.id,
      track_id: null,
      issue_type: "missing_release_date",
      severity: "warning",
      message: `"${album.title}" has no release date set.`,
    });
  }

  if (tracks.length === 0) {
    findings.push({
      album_id: album.id,
      track_id: null,
      issue_type: "track_count_mismatch",
      severity: "error",
      message: `"${album.title}" has no tracks.`,
    });
  } else {
    // Positions are unique per album (DB constraint) and should be a
    // contiguous 1..N run. A gap here means a track went missing without
    // the rest of the tracklist being renumbered.
    const maxPosition = Math.max(...tracks.map((t) => t.position));
    if (maxPosition !== tracks.length) {
      findings.push({
        album_id: album.id,
        track_id: null,
        issue_type: "track_count_mismatch",
        severity: "error",
        message: `"${album.title}" has ${tracks.length} track(s) but positions run up to ${maxPosition} — the tracklist likely has a gap.`,
      });
    }
  }

  for (const track of tracks) {
    if (!track.isrc) {
      findings.push({
        album_id: album.id,
        track_id: track.id,
        issue_type: "missing_isrc",
        severity: "warning",
        message: `Track ${track.position}. "${track.title}" has no ISRC.`,
      });
    }
    if (!track.lyrics_plain && !track.lyrics_synced) {
      findings.push({
        album_id: album.id,
        track_id: track.id,
        issue_type: "missing_lyrics",
        severity: "warning",
        message: `Track ${track.position}. "${track.title}" has no lyrics.`,
      });
    }
    if (!track.audio_file_url) {
      findings.push({
        album_id: album.id,
        track_id: track.id,
        issue_type: "missing_audio_file",
        severity: "error",
        message: `Track ${track.position}. "${track.title}" has no audio file attached.`,
      });
    }
  }

  return findings;
}

/** ISRCs must be unique across the whole catalog, not just within an album. */
function checkDuplicateIsrcs(albumsById: Map<string, Album>, allTracks: Track[]): IssueFinding[] {
  const byIsrc = new Map<string, Track[]>();
  for (const track of allTracks) {
    if (!track.isrc) continue;
    const list = byIsrc.get(track.isrc) ?? [];
    list.push(track);
    byIsrc.set(track.isrc, list);
  }

  const findings: IssueFinding[] = [];
  for (const [isrc, tracks] of byIsrc) {
    if (tracks.length < 2) continue;
    for (const track of tracks) {
      const otherLabels = tracks
        .filter((t) => t.id !== track.id)
        .map((o) => {
          const album = albumsById.get(o.album_id);
          return album ? `"${album.title}" track ${o.position}` : o.id;
        })
        .join(", ");
      findings.push({
        album_id: track.album_id,
        track_id: track.id,
        issue_type: "duplicate_isrc",
        severity: "error",
        message: `ISRC ${isrc} is also used by ${otherLabels}.`,
      });
    }
  }
  return findings;
}

/** Groups by title only, not (title, artist) — an accidental repeat import
 * can carry a different artist spelling each time if it came through AI
 * extraction (e.g. a misread screenshot), so matching on artist too would
 * miss exactly the case this check exists to catch. */
function checkLikelyDuplicateAlbums(albums: Album[]): IssueFinding[] {
  const byTitle = new Map<string, Album[]>();
  for (const album of albums) {
    const key = album.title.trim().toLowerCase();
    const list = byTitle.get(key) ?? [];
    list.push(album);
    byTitle.set(key, list);
  }

  const findings: IssueFinding[] = [];
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const artists = [...new Set(group.map((a) => a.artist))];
    const artistNote =
      artists.length === 1
        ? `all under "${artists[0]}"`
        : `under different artist names: ${artists.map((a) => `"${a}"`).join(", ")}`;
    for (const album of group) {
      findings.push({
        album_id: album.id,
        track_id: null,
        issue_type: "likely_duplicate_album",
        severity: "warning",
        message: `"${album.title}" appears ${group.length} times in your catalog (${artistNote}) — looks like a repeat import. Keep one and delete the rest.`,
      });
    }
  }
  return findings;
}

/** Reads only enough of the artwork file to determine its pixel dimensions. */
async function checkArtwork(album: Album): Promise<IssueFinding | null> {
  if (!album.artwork_url) {
    return {
      album_id: album.id,
      track_id: null,
      issue_type: "artwork_too_small",
      severity: "error",
      message: `"${album.title}" has no artwork uploaded (need at least ${MIN_ARTWORK_DIMENSION}x${MIN_ARTWORK_DIMENSION}).`,
    };
  }

  try {
    const res = await fetch(album.artwork_url, { headers: { Range: "bytes=0-65535" } });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { width, height } = imageSize(bytes);
    if (width < MIN_ARTWORK_DIMENSION || height < MIN_ARTWORK_DIMENSION) {
      return {
        album_id: album.id,
        track_id: null,
        issue_type: "artwork_too_small",
        severity: "error",
        message: `"${album.title}" artwork is ${width}x${height} — most distributors require at least ${MIN_ARTWORK_DIMENSION}x${MIN_ARTWORK_DIMENSION}.`,
      };
    }
    return null;
  } catch {
    return {
      album_id: album.id,
      track_id: null,
      issue_type: "artwork_too_small",
      severity: "error",
      message: `"${album.title}" artwork could not be read to verify its dimensions.`,
    };
  }
}

export async function runCatalogHealthCheck(
  albums: Album[],
  tracksByAlbumId: Map<string, Track[]>
): Promise<IssueFinding[]> {
  const albumsById = new Map(albums.map((a) => [a.id, a]));
  const allTracks = albums.flatMap((a) => tracksByAlbumId.get(a.id) ?? []);

  const findings: IssueFinding[] = [];
  for (const album of albums) {
    findings.push(...checkAlbumFields(album, tracksByAlbumId.get(album.id) ?? []));
  }
  findings.push(...checkDuplicateIsrcs(albumsById, allTracks));
  findings.push(...checkLikelyDuplicateAlbums(albums));

  const artworkFindings = await Promise.all(albums.map(checkArtwork));
  for (const f of artworkFindings) {
    if (f) findings.push(f);
  }

  return findings;
}
