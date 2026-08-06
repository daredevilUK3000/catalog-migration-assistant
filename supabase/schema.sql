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

  -- Despite the name, a local reference, not a storage URL: the filename
  -- or relative path of a file on the musician's own machine, either
  -- verified via the browser's File System Access API or self-attested
  -- where that's unsupported (see lib/localAudio.ts). The audio file
  -- itself is never uploaded or stored server-side.
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

-- CD Baby: added after the other four, once its submission flow was
-- sourced (see the export_field_map update further below for how, since
-- there was no free way to view the actual submission form directly). No
-- bulk CSV feature turned up anywhere in CD Baby's own documentation.
insert into distributor_profiles (slug, display_name, supports_bulk_csv, export_field_map)
values
  ('cdbaby', 'CD Baby', false, '{}'::jsonb)
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

-- CD Baby: added without a paid CD Baby account (its submission flow sits
-- behind a per-release fee, so there was no free way to view it directly).
-- Sourced instead from two things together: (1) CD Baby's own public Help
-- Center — no login required — specifically "Understanding the Title
-- Overview Page" (names the real section structure: Summary Box, Tracks &
-- Audio, Distribution, Social Video Monetization, CDB Boost, Service
-- Agreements, and the fields inside each), "How do I add artist credits to
-- my release?" (names the actual sub-pages: Basic Album Information vs
-- Basic Single Information — albums and singles genuinely diverge here,
-- same as Ditto — plus Track Information for per-track roles and a
-- separate Songwriter Information step), "How do I add or edit songwriters
-- for my release?" (the real Songwriter Bank fields: legal name, country,
-- PRO, Music/Lyrics contribution + %, publisher), and "Can I get ISRCs
-- from CD Baby?" (confirms auto-assignment at inspection unless you supply
-- your own — same pattern as Ditto's ISRC toggle). (2) Four screenshots of
-- an actual CD Baby account's Title Overview page for a real release,
-- corroborating that every field named above is real and cross-checking
-- the section grouping against the docs.
--
-- Two fields visible in the screenshots were deliberately left out: Spotify
-- URI and the Partner Artist IDs (Apple Music/iTunes, YouTube Music, etc).
-- Neither appears in the Help Center's own list of Summary Box fields, and
-- both are values a platform assigns *after* distribution, not something
-- typed in during submission — this export map is for what you fill in on
-- the target form, not a dump of everything the account page displays.
-- Same reasoning excludes FastForward (paid expedited-inspection add-on)
-- and CDB Boost (a separate upsell, not release metadata).
update distributor_profiles
set export_field_map = '{
  "fields": [
    { "source": "title", "label": "Release Title", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "artist", "label": "Artist Name", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "record_label", "label": "Record Label", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "upc", "label": "UPC (CD Baby auto-assigns one during inspection unless you already have your own)", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "release_date", "label": "Release Date", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "pre_order_date", "label": "Pre-Order Date (optional)", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "genre", "label": "Primary Genre", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "secondary_genre", "label": "Secondary Genre (optional)", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "subgenre", "label": "Primary Subgenre", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "secondary_subgenre", "label": "Secondary Subgenre", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "mood_style", "label": "Mood/Style", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "language", "label": "Album Language", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "artist_location", "label": "Artist Location", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "artist_sounds_like", "label": "Artist Sounds Like (optional — similar existing artists)", "step": "Title Overview → Basic Album Information (Basic Single Information for a single)" },
    { "source": "track.title", "label": "Track Title", "step": "Title Overview → Track Information (per track)" },
    { "source": "track.composition_type", "label": "Composition Type (Original / Cover / Public Domain)", "step": "Title Overview → Track Information (per track)" },
    { "source": "track.isrc", "label": "ISRC (CD Baby auto-assigns one during inspection unless you already have your own)", "step": "Title Overview → Track Information (per track)" },
    { "source": "track.explicit", "label": "Parental Advisory (explicit content)", "step": "Title Overview → Track Information (per track)" },
    { "source": "track.studio_or_live", "label": "Studio or Live Recording", "step": "Title Overview → Track Information (per track)" },
    { "source": "track.available_for_sale", "label": "Available for Sale as an individual track", "step": "Title Overview → Track Information (per track)" },
    { "source": "track.performance_language", "label": "Performance Language", "step": "Title Overview → Track Information (per track)" },
    { "source": "track.featured_artists", "label": "Featuring credit(s)", "step": "Title Overview → Track Information (per track) → add-role" },
    { "source": "track.producer_credits", "label": "Producer credit(s)", "step": "Title Overview → Track Information (per track) → add-role" },
    { "source": "track.remixer_credit", "label": "Remixer credit", "step": "Title Overview → Track Information (per track) → add-role" },
    { "source": "track.production_engineering_credits", "label": "Production and Engineering credit(s)", "step": "Title Overview → Track Information (per track) → add-role" },
    { "source": "track.performer_credits", "label": "Other Contributors — performer credits (e.g. Vocals, Guitar)", "step": "Title Overview → Track Information (per track) → add-role" },
    { "source": "track.composer", "label": "Composer (Music contribution)", "step": "Title Overview → Songwriter Information (per track, via Songwriter Bank)" },
    { "source": "track.lyricist", "label": "Lyricist (Lyrics contribution)", "step": "Title Overview → Songwriter Information (per track, via Songwriter Bank)" },
    { "source": "track.songwriter_split_percent", "label": "Songwriter ownership % (must total 100% across all songwriters on the track)", "step": "Title Overview → Songwriter Information (per track, via Songwriter Bank)" },
    { "source": "track.songwriter_pro", "label": "Songwriter PRO affiliation (if applicable)", "step": "Title Overview → Songwriter Information (per track, via Songwriter Bank)" },
    { "source": "track.publisher", "label": "Publisher (or \"No\" if none)", "step": "Title Overview → Songwriter Information (per track, via Songwriter Bank)" },
    { "source": "track.credits", "label": "All credits on file (reference only — sort names into Composer/Lyricist/roles above by hand)", "step": "Title Overview → Songwriter Information (per track, via Songwriter Bank)" }
  ]
}'::jsonb
where slug = 'cdbaby';

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
-- PROFILES
-- One row per user, created only on first purchase (upserted by the Stripe
-- webhook, see app/api/webhooks/stripe/route.ts) — not on signup. The
-- premium gate (lib/auth/premium.ts) treats "no row" the same as
-- is_premium = false, so no signup trigger is needed.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  is_premium boolean not null default false,
  purchased_at timestamptz,
  stripe_customer_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_stripe_customer_id on profiles(stripe_customer_id);

-- Writes only ever come from the Stripe webhook via the admin client
-- (bypasses RLS) — same convention as every other write path in this app —
-- so only a self-read policy is needed here.
alter table profiles enable row level security;
create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

-- ============================================================
-- STORAGE BUCKETS
-- Album artwork only. Track audio briefly moved through Cloudflare R2
-- (lib/r2/storage.ts, R2_ACCOUNT_ID etc. in .env) after this project's
-- Supabase plan proved too small a bucket file_size_limit (50MB cap,
-- confirmed by probing 200/100/50MB directly against the Storage API) for
-- uncompressed WAV masters — but under a one-time-purchase pricing model,
-- storing audio centrally at all (on any provider) is an unsustainable
-- ongoing cost. Audio is now local-first instead: verified or self-attested
-- on the musician's own machine (lib/localAudio.ts), never uploaded. R2
-- stays wired up, unused, in case artwork ever moves there.
--
-- Artwork uploads go through a server-issued signed upload URL (see
-- app/api/files/sign) using the service role, which bypasses storage RLS —
-- no storage.objects policies needed for that path. Public for reads:
-- next.config.ts already allowlists *.supabase.co for next/image, and
-- paths are UUID-scoped (not enumerable), but nothing stored here should
-- be treated as secret.
--
-- An 'audio' bucket may still exist from before the R2 move — it's unused
-- and safe to delete; nothing was ever successfully uploaded to it (the
-- 50MB cap is what forced the move to R2 in the first place, and R2 itself
-- is now unused too).
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('artwork', 'artwork', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
