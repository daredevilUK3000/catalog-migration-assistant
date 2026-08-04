import type { Album, Track } from "@/types/catalog";

export interface CatalogBackupTrack {
  position: number;
  title: string;
  isrc: string | null;
  lyrics_plain: string | null;
  lyrics_synced: string | null;
  audio_file_reference: string | null;
  credits: Track["credits"];
}

export interface CatalogBackupAlbum {
  title: string;
  artist: string;
  upc: string | null;
  release_date: string | null;
  genre: string | null;
  artwork_url: string | null;
  source_distributor: string | null;
  tracks: CatalogBackupTrack[];
}

export interface CatalogBackup {
  format: "catalog-migration-assistant-backup";
  format_version: 1;
  generated_at: string;
  album_count: number;
  track_count: number;
  albums: CatalogBackupAlbum[];
}

/** Portable, distributor-independent snapshot of the master catalog — every
 * album/track field the musician owns, re-importable in principle even if
 * this app or its database ever went away. Deliberately excludes internal
 * ids, user_id, and timestamps: those are this app's bookkeeping, not
 * catalog data the musician needs back. audio_file_url is renamed to
 * audio_file_reference in the output since it's always a local
 * filename/path, never an actual URL (see Track.audio_file_url's own
 * comment in types/catalog.ts) — the export shouldn't perpetuate that
 * misleading name. */
export function buildCatalogBackup(
  albums: Album[],
  tracksByAlbumId: Map<string, Track[]>
): CatalogBackup {
  const backupAlbums: CatalogBackupAlbum[] = albums.map((album) => {
    const tracks = [...(tracksByAlbumId.get(album.id) ?? [])].sort(
      (a, b) => a.position - b.position
    );
    return {
      title: album.title,
      artist: album.artist,
      upc: album.upc,
      release_date: album.release_date,
      genre: album.genre,
      artwork_url: album.artwork_url,
      source_distributor: album.source_distributor,
      tracks: tracks.map((track) => ({
        position: track.position,
        title: track.title,
        isrc: track.isrc,
        lyrics_plain: track.lyrics_plain,
        lyrics_synced: track.lyrics_synced,
        audio_file_reference: track.audio_file_url,
        credits: track.credits,
      })),
    };
  });

  return {
    format: "catalog-migration-assistant-backup",
    format_version: 1,
    generated_at: new Date().toISOString(),
    album_count: backupAlbums.length,
    track_count: backupAlbums.reduce((sum, a) => sum + a.tracks.length, 0),
    albums: backupAlbums,
  };
}
