-- Catalog Migration Assistant — core schema
-- Run this in the Supabase SQL editor for a fresh project.

-- ============================================================
-- ALBUMS
-- ============================================================
create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  artist text not null,
  upc text,
  release_date date,
  genre text,
  artwork_url text,

  -- Where this album's data originally came from (for reference/debugging import quality)
  source_distributor text,

  -- import_status: raw import lifecycle for this record
  import_status text not null default 'draft'
    check (import_status in ('draft', 'confirmed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_albums_user_id on albums(user_id);

-- ============================================================
-- TRACKS
-- ============================================================
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,

  position integer not null,
  title text not null,
  isrc text,

  lyrics_plain text,
  lyrics_synced text,
  audio_file_url text,

  -- Songwriter/producer/performer credits and splits, kept flexible
  credits jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (album_id, position)
);

create index if not exists idx_tracks_album_id on tracks(album_id);
create index if not exists idx_tracks_isrc on tracks(isrc);

-- ============================================================
-- CATALOG HEALTH ISSUES
-- Deterministic validation findings — no AI involved in producing these.
-- ============================================================
create table if not exists catalog_issues (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,

  issue_type text not null
    check (issue_type in (
      'missing_isrc',
      'duplicate_isrc',
      'missing_lyrics',
      'missing_audio_file',
      'artwork_too_small',
      'missing_release_date',
      'missing_upc',
      'missing_songwriter_credit',
      'track_count_mismatch',
      'likely_duplicate_album'
    )),
  severity text not null default 'warning'
    check (severity in ('warning', 'error')),
  message text not null,

  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_catalog_issues_album_id on catalog_issues(album_id);
create index if not exists idx_catalog_issues_resolved on catalog_issues(resolved);

-- Migration Confidence Score feature: adds missing_upc and
-- missing_songwriter_credit as detectable issue types, and separately fixes a
-- pre-existing gap — likely_duplicate_album has been a valid TypeScript
-- IssueType (and something checkLikelyDuplicateAlbums in lib/catalogHealth.ts
-- actually inserts) since before this feature, but was never in this
-- constraint, so those inserts would have failed against a DB created from
-- this file. Safe to re-run: drops and recreates the constraint with the
-- full set below.
alter table catalog_issues drop constraint if exists catalog_issues_issue_type_check;
alter table catalog_issues add constraint catalog_issues_issue_type_check
  check (issue_type in (
    'missing_isrc',
    'duplicate_isrc',
    'missing_lyrics',
    'missing_audio_file',
    'artwork_too_small',
    'missing_release_date',
    'missing_upc',
    'missing_songwriter_credit',
    'track_count_mismatch',
    'likely_duplicate_album'
  ));

-- ============================================================
-- DISTRIBUTOR PROFILES
-- Defines how to map the master catalog schema into each distributor's
-- expected import/export shape. Adding a distributor = adding a row here,
-- not shipping new code.
-- ============================================================
create table if not exists distributor_profiles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,

  supports_bulk_csv boolean not null default false,

  -- Field mapping / ordering metadata used by the export-pack generator.
  -- Shape is intentionally flexible per distributor, e.g.:
  -- { "fields": [{ "source": "title", "label": "Release Title" }, ...] }
  export_field_map jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Seed the two distributors relevant to the first migration.
-- emastered and tunecore are tracker-only for now: no export_field_map, so
-- the Export Pack screen renders blank for them until a real one gets built
-- from actual screenshots/HTML the way Ditto's and DistroKid's were.
insert into distributor_profiles (slug, display_name, supports_bulk_csv, export_field_map)
values
  ('distrokid', 'DistroKid', false, '{}'::jsonb),
  ('ditto', 'Ditto Music', false, '{}'::jsonb),
  ('emastered', 'eMastered', false, '{}'::jsonb),
  ('tunecore', 'TuneCore', false, '{}'::jsonb)
on conflict (slug) do nothing;

-- DistroKid: verified from the real upload/edit form's saved HTML (field
-- names read directly from `name=` attributes and their adjacent label
-- text) — a different confidence profile than Ditto's screenshots. Field
-- *names* are as reliable as Ditto's; field *order* is less certain, since
-- the relevant markup carries an `upload-mobile-*` class prefix suggesting
-- this may be a mobile-layout copy, and the page has no wizard/step
-- structure at all (single continuous form, unlike Ditto's 5 pages) — so
-- everything below sits under one step. Correct the order here if it
-- doesn't match what you actually see on screen.
--
-- Two things confirmed, not guessed, directly from DistroKid's own page
-- text: (1) UPC is never user-specifiable, on any plan — their own terms
-- say so explicitly ("you can choose to specify your own ISRC codes, but
-- not UPC codes"), so upc is mapped with that fact stated outright rather
-- than left an open question. (2) There is no lyrics field anywhere on
-- this form — DistroKid lyrics distribution is a separate product
-- (distrokid.com/lyrics), not part of a release's metadata here — so
-- unlike Ditto, track.lyrics_plain has no row at all rather than a
-- misleading placeholder.
--
-- Same pattern as Ditto for structured credits: DistroKid has its own
-- multi-category system (Songwriter real names with a role + first/
-- middle/last name; Performer and Producer/Engineer credits, each with
-- name + a role picked from a large controlled list) that this app's
-- freeform Credit type can't be reliably auto-sorted into — those
-- categories are listed blank for manual fill-in, alongside the same
-- "all credits on file" reference-dump row.
update distributor_profiles
set export_field_map = '{
  "fields": [
    { "source": "release_date", "label": "Original release date (flip \"Has this single been previously released?\" to Yes first — true for every migrated release)", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "new_listing_date", "label": "Release date (new/current DistroKid listing date — a forward-looking decision, distinct from the original release date above)", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "record_label", "label": "Record label", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "upc", "label": "UPC / Barcode — DistroKid never accepts a custom UPC, on any plan; always auto-generated", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "language", "label": "Language", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "genre", "label": "Primary genre", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "subgenre", "label": "Primary subgenre", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "secondary_genre", "label": "Secondary genre (optional)", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "secondary_subgenre", "label": "Secondary subgenre", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "title", "label": "Album Title", "step": "Upload/edit form (single page, no wizard steps)" },
    { "source": "track.title", "label": "Song title", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.featured_artists", "label": "Featured artist(s) (name + role: Featured artist / Additional primary artist — repeatable)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.version_info", "label": "Version info (e.g. \"Extended Remix\", \"Acoustic\")", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.composer", "label": "Composer (Classical genre only)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.is_cover_song", "label": "Cover song? (No = original song / Yes = cover)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.cover_original_artist", "label": "Original artist (cover songs only, required)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.cover_original_title", "label": "Original song title (cover songs only, required)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.cover_original_songwriters", "label": "Original songwriter(s) (cover songs only, optional)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.songwriter_real_names", "label": "Songwriter(s) real name(s) (role: Music / Lyrics / Music and lyrics + first/middle/last name — repeatable)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.isrc", "label": "ISRC (click \"Already have an ISRC code?\" first — otherwise DistroKid generates one)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.explicit", "label": "Explicit lyrics? (No / Yes)", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.performer_credits", "label": "Performer credits (name + role from a large instrument/role list — repeatable, under \"Additional credits\")", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.producer_credits", "label": "Producer/Engineer credits (name + role from a large engineering-role list — repeatable, under \"Additional credits\")", "step": "Upload/edit form (single page, no wizard steps) → per track" },
    { "source": "track.credits", "label": "All credits on file (reference only — sort names into the categories above by hand)", "step": "Upload/edit form (single page, no wizard steps) → per track" }
  ]
}'::jsonb
where slug = 'distrokid';

-- Ditto: the "Details" step (2 of 5: Upload -> Details -> Schedule -> Store
-- -> Review) is verified from real screenshots, including expanding a
-- track's "Edit Metadata" panel within Details — field labels and order
-- below are exact for both the release-level and per-track sections.
--
-- Schedule (3 of 5) turned out to have TWO release-date fields, not one —
-- caught and corrected after toggling "Has this been released before?" to
-- Yes revealed a second field. "Choose a release date" is always visible
-- (a forward-looking scheduling decision for the new Ditto listing); "Enter
-- the original release date" only appears once that toggle is Yes. This
-- app's release_date is populated from what''s shown on the *existing*
-- distributor listing during import (the extraction prompt treats it as
-- historical fact, and the health check flags a missing one as core
-- catalog metadata) — so it''s "original release date", not "choose a
-- release date". An earlier version of this mapping pointed release_date
-- at "Choose a release date" instead; that was wrong and is fixed here.
-- upc: Upload, Details, and Schedule showed no such field. Store was later
-- checked too (both an HTML save and two screenshots of the DSP checklist +
-- paid add-ons + per-track pricing step) — still nothing. That''s 4 of 5
-- steps clear; only Review (step 5) remains unseen. Likely auto-assigned
-- like DistroKid, but that''s inference from absence, not a confirmed
-- policy statement the way DistroKid''s terms text is — left flagged as
-- such rather than stated as fact.
--
-- Several real fields have no home in this app's schema yet (copyright
-- holder, record label, language, artist type at release level; mix
-- version, per-track copyright, per-track primary artist, explicit flag,
-- and Ditto's 4-bucket credit structure at track level) — rather than drop
-- them, they're listed with a `source` that resolves to nothing, so the
-- sheet still shows the label in the right place, blank, for manual
-- fill-in.
--
-- Two things worth knowing that the field list alone doesn't capture:
-- (1) ISRC and Lyrics are toggle-gated on the real form ("Who
--     autogenerated this track''s ISRC? Enter your own?" / "Add lyrics?")
--     — the input only appears after flipping the toggle, noted in the
--     label itself since it''s easy to miss and ISRC continuity is the
--     one thing this whole app is built to protect.
-- (2) Ditto''s per-track credits are 4 required categories (Composer;
--     Songwriter + a role like "Lyricist"; Production/Engineer + a role
--     like "Producer"; Performer + a role like "Lead Vocals"), not a
--     freeform list. This app''s Credit type IS a freeform {role, name}
--     list with no fixed categories, so there''s no reliable, non-guessing
--     way to sort a track''s credits into Ditto''s 4 buckets automatically
--     — the existing track.credits row is kept as a full reference dump
--     (relabeled) so the raw data is still visible while filling in the
--     4 bucket fields by hand.
update distributor_profiles
set export_field_map = '{
  "fields": [
    { "source": "title", "label": "Release Title", "step": "Details" },
    { "source": "copyright_holder_c", "label": "© Copyright Holder", "step": "Details" },
    { "source": "copyright_year", "label": "Copyright Year", "step": "Details" },
    { "source": "copyright_holder_p", "label": "℗ Copyright Holder", "step": "Details" },
    { "source": "production_year", "label": "Production Year", "step": "Details" },
    { "source": "record_label", "label": "Record Label", "step": "Details" },
    { "source": "genre", "label": "Primary Genre", "step": "Details" },
    { "source": "secondary_genre", "label": "Secondary Genre (optional)", "step": "Details" },
    { "source": "language", "label": "Language", "step": "Details" },
    { "source": "artist_type", "label": "Artist Type (Artist/Band or Compilation/Various Artists)", "step": "Details" },
    { "source": "artist", "label": "Primary Artist(s)", "step": "Details" },
    { "source": "new_listing_date", "label": "Choose a release date (new Ditto listing date — a forward-looking decision, distinct from the original release date below, so left for you to set)", "step": "Schedule" },
    { "source": "release_date", "label": "Original Release Date (flip \"Has this been released before?\" to Yes first — true for every migrated release; this is the field, not the always-visible \"Choose a release date\" above)", "step": "Schedule" },
    { "source": "upc", "label": "UPC / Barcode — not found on Upload, Details, Schedule, or Stores (confirmed absent from Stores via both HTML and screenshots — it''s a DSP checklist plus paid add-ons and per-track pricing, nothing else); likely auto-assigned like DistroKid, but Review (step 5) is the one page still unseen", "step": "Not yet verified — Review (5 of 5) unseen" },
    { "source": "track.title", "label": "Track Title", "step": "Details → Tracklist (per track)" },
    { "source": "track.mix_version", "label": "Track Mix Version (optional, e.g. Radio Edit)", "step": "Details → Tracklist (per track)" },
    { "source": "track.artist", "label": "Track Primary Artist(s) (if different from release artist)", "step": "Details → Tracklist (per track)" },
    { "source": "track.copyright_holder_c", "label": "Track © Copyright Holder", "step": "Details → Tracklist (per track)" },
    { "source": "track.copyright_year", "label": "Track Copyright Year", "step": "Details → Tracklist (per track)" },
    { "source": "track.copyright_holder_p", "label": "Track ℗ Copyright Holder", "step": "Details → Tracklist (per track)" },
    { "source": "track.production_year", "label": "Track Production Year", "step": "Details → Tracklist (per track)" },
    { "source": "track.isrc", "label": "ISRC (flip \"Enter your own\" toggle first — otherwise Ditto autogenerates one)", "step": "Details → Tracklist (per track)" },
    { "source": "track.lyrics_plain", "label": "Lyrics (flip \"Add lyrics?\" toggle first)", "step": "Details → Tracklist (per track)" },
    { "source": "track.explicit", "label": "Explicit content?", "step": "Details → Tracklist (per track)" },
    { "source": "track.composer", "label": "Composer", "step": "Details → Tracklist (per track) → Track Credits" },
    { "source": "track.songwriter", "label": "Songwriter", "step": "Details → Tracklist (per track) → Track Credits" },
    { "source": "track.songwriter_role", "label": "Songwriter Role (e.g. Lyricist)", "step": "Details → Tracklist (per track) → Track Credits" },
    { "source": "track.production_engineer", "label": "Production/Engineer", "step": "Details → Tracklist (per track) → Track Credits" },
    { "source": "track.production_engineer_role", "label": "Production/Engineer Role (e.g. Producer)", "step": "Details → Tracklist (per track) → Track Credits" },
    { "source": "track.performer", "label": "Performer", "step": "Details → Tracklist (per track) → Track Credits" },
    { "source": "track.performer_role", "label": "Performer Role (e.g. Lead Vocals)", "step": "Details → Tracklist (per track) → Track Credits" },
    { "source": "track.credits", "label": "All credits on file (reference only — sort names into the 4 categories above by hand)", "step": "Details → Tracklist (per track) → Track Credits" }
  ]
}'::jsonb
where slug = 'ditto';

-- ============================================================
-- MIGRATION RECORDS
-- Tracks an album's journey from one distributor to another.
-- ============================================================
create table if not exists migration_records (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,

  source_distributor_id uuid references distributor_profiles(id),
  target_distributor_id uuid references distributor_profiles(id),

  -- Overall migration stage for this album
  status text not null default 'imported'
    check (status in (
      'imported',
      'files_attached',
      'health_checked',
      'export_pack_generated',
      'uploaded',
      'verified'
    )),

  -- Independent from `status` — tracks takedown at the *source* distributor,
  -- relevant when preserving stream history matters.
  takedown_status text not null default 'not_requested'
    check (takedown_status in ('not_requested', 'requested', 'processing', 'cleared')),

  uploaded_at timestamptz,
  verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (album_id, target_distributor_id)
);

create index if not exists idx_migration_records_album_id on migration_records(album_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Single-user catalog ownership — straightforward auth.uid() checks.
-- (No org-table subquery needed here since ownership is direct, not via
-- an intermediate org membership table.)
-- ============================================================
alter table albums enable row level security;
alter table tracks enable row level security;
alter table catalog_issues enable row level security;
alter table migration_records enable row level security;

create policy "Users manage their own albums"
  on albums for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage tracks on their own albums"
  on tracks for all
  using (exists (select 1 from albums where albums.id = tracks.album_id and albums.user_id = auth.uid()))
  with check (exists (select 1 from albums where albums.id = tracks.album_id and albums.user_id = auth.uid()));

create policy "Users manage issues on their own albums"
  on catalog_issues for all
  using (exists (select 1 from albums where albums.id = catalog_issues.album_id and albums.user_id = auth.uid()))
  with check (exists (select 1 from albums where albums.id = catalog_issues.album_id and albums.user_id = auth.uid()));

create policy "Users manage migration records on their own albums"
  on migration_records for all
  using (exists (select 1 from albums where albums.id = migration_records.album_id and albums.user_id = auth.uid()))
  with check (exists (select 1 from albums where albums.id = migration_records.album_id and albums.user_id = auth.uid()));

-- distributor_profiles is shared reference data — readable by any authenticated user, not user-owned.
alter table distributor_profiles enable row level security;
create policy "Authenticated users can read distributor profiles"
  on distributor_profiles for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE BUCKETS
-- Album artwork only — track audio moved to Cloudflare R2 (lib/r2/storage.ts,
-- R2_ACCOUNT_ID etc. in .env), since this project's Supabase plan caps
-- bucket file_size_limit at 50MB (confirmed by probing 200/100/50MB
-- directly against the Storage API), too small for uncompressed WAV
-- masters. Uploads go through a server-issued signed upload URL (see
-- app/api/files/sign) using the service role, which bypasses storage RLS —
-- no storage.objects policies needed for that path. Public for reads:
-- next.config.ts already allowlists *.supabase.co for next/image, and
-- paths are UUID-scoped (not enumerable), but nothing stored here should
-- be treated as secret.
--
-- An 'audio' bucket may still exist from before this move — it's unused
-- now and safe to delete; nothing was ever successfully uploaded to it
-- (the 50MB cap is what forced the move to R2 in the first place).
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('artwork', 'artwork', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
