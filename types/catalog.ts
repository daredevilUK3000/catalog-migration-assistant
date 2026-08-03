export type ImportStatus = "draft" | "confirmed";

export type MigrationStatus =
  | "imported"
  | "files_attached"
  | "health_checked"
  | "export_pack_generated"
  | "uploaded"
  | "verified";

export type TakedownStatus = "not_requested" | "requested" | "processing" | "cleared";

export type IssueType =
  | "missing_isrc"
  | "duplicate_isrc"
  | "missing_lyrics"
  | "missing_audio_file"
  | "artwork_too_small"
  | "missing_release_date"
  | "track_count_mismatch"
  | "likely_duplicate_album";

export type IssueSeverity = "warning" | "error";

export interface Credit {
  role: string; // e.g. "Songwriter", "Producer", "Performer"
  name: string;
  split_percent?: number;
}

export interface Album {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  upc: string | null;
  release_date: string | null;
  genre: string | null;
  artwork_url: string | null;
  source_distributor: string | null;
  import_status: ImportStatus;
  created_at: string;
  updated_at: string;
}

export interface Track {
  id: string;
  album_id: string;
  position: number;
  title: string;
  isrc: string | null;
  lyrics_plain: string | null;
  lyrics_synced: string | null;
  // Despite the name, this holds an R2 object key once audio is attached,
  // not a directly usable URL — the bucket is private, so reads always go
  // through a freshly generated signed URL (see lib/r2/storage.ts).
  audio_file_url: string | null;
  credits: Credit[];
  created_at: string;
  updated_at: string;
}

export interface CatalogIssue {
  id: string;
  album_id: string;
  track_id: string | null;
  issue_type: IssueType;
  severity: IssueSeverity;
  message: string;
  resolved: boolean;
  created_at: string;
}

export interface DistributorExportField {
  source: string; // key path into Album/Track, e.g. "title" or "track.isrc". A
  // key with no matching Album/Track field (e.g. "record_label") is valid —
  // it renders as a labeled-but-blank row for a field the form asks for
  // that this app doesn't track, so the reference sheet still lists it in
  // the right place for manual fill-in.
  label: string; // label as shown on the distributor's own form
  step?: string; // which page of the distributor's real submission flow this
  // field appears on, e.g. Ditto's "Details" vs "Schedule" step. Fields
  // without a verified step should say so explicitly (e.g. "Not yet
  // verified") rather than being silently grouped as if confirmed.
}

export interface DistributorProfile {
  id: string;
  slug: string;
  display_name: string;
  supports_bulk_csv: boolean;
  export_field_map: {
    fields?: DistributorExportField[];
  };
  created_at: string;
}

export interface MigrationRecord {
  id: string;
  album_id: string;
  source_distributor_id: string | null;
  target_distributor_id: string | null;
  status: MigrationStatus;
  takedown_status: TakedownStatus;
  uploaded_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the import/extraction step, before user confirmation. */
export interface ExtractedAlbumDraft {
  title: string;
  artist: string;
  release_date?: string;
  upc?: string;
  genre?: string;
  tracks: {
    position: number;
    title: string;
    isrc?: string;
  }[];
}
