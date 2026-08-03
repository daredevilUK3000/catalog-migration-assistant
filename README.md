# Catalog Migration Assistant

Gives independent musicians a permanent, distributor-independent copy of
their catalog, and generates what they need to move it to a new
distributor — without ever automating against a distributor's website.

Full product outline: see `docs/product-outline.md` (copy it in from the
chat conversation where this was designed).

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Storage)

## What's scaffolded so far

- `supabase/schema.sql` — full schema: `albums`, `tracks`, `catalog_issues`,
  `distributor_profiles`, `migration_records`, RLS policies, and the
  `artwork` / `audio` storage buckets. Run this in the Supabase SQL editor
  to set up a fresh project (safe to re-run — idempotent).
- `types/catalog.ts` — TypeScript types matching the schema, plus
  `ExtractedAlbumDraft` for the shape returned by the import step before
  user confirmation.
- `lib/supabase/client.ts` / `server.ts` / `admin.ts` — the three Supabase
  client variants. **Use `admin.ts` for server-side data fetching, and run
  sequential queries rather than relying on embedded joins** — that's bitten
  this pattern before on other projects in this portfolio.
- **Import flow** (`/import`): pick a source type, extract, then the same
  editable confirm table → save (`app/api/import/confirm`) for every path,
  writing `Album` + `Track` rows with `import_status = 'confirmed'`. Three
  source types, two different extraction strategies:
  - **Screenshot / PDF** — AI extraction (`app/api/import/screenshot`,
    `app/api/import/pdf`; shared prompt/schema/response-handling in
    `lib/importExtraction.ts`), one release per file. PDF reuses the exact
    same Claude call, just swapping an `image` content block for a
    `document` one — verified for real with a hand-built minimal PDF
    (Anthropic accepted the request and extracted the fields correctly),
    not assumed from the docs.
  - **CSV / Excel** — no AI, plain deterministic parsing
    (`lib/importCsv.ts`, `app/api/import/csv`), and unlike the other two
    paths, one file can contain a whole catalog: rows are grouped into one
    `ExtractedAlbumDraft` per (album, artist) pair, so a single upload can
    produce several releases. Recognizes a handful of common header
    spellings ("Album"/"Release Title", "Artist", "Track"/"Track Title",
    etc.) but doesn't try to be clever beyond that — an unrecognized
    header set fails loudly with what was expected and what was found,
    same philosophy as the export-pack field mapping: guessing wrong here
    is worse than a clear error. `.xlsx` goes through `read-excel-file`;
    `.csv` through a small hand-rolled RFC 4180 parser; legacy `.xls` is
    explicitly rejected with a message to re-save it. **I evaluated and
    rejected the obvious `xlsx` (SheetJS) npm package** — the
    npm-published build has two unpatched high-severity CVEs (prototype
    pollution, ReDoS) in exactly the code path this feature exercises
    (parsing untrusted uploaded files) — and picked `read-excel-file`
    instead, which added zero new vulnerabilities per `npm audit`.
  - The confirm step handles all three uniformly: `ConfirmAlbumForm`
    (`app/import/ConfirmAlbumForm.tsx`) is the same editable-table
    component from before, factored out and reused; the page just wraps
    it in a queue for multi-release CSV batches (remounted via `key` per
    queue slot — cleaner than syncing props into stale local state), with
    a "Release N of M" label and a "Skip this release" option that only
    appears mid-batch.
- **File attachment** (`/albums/attach?id=<albumId>`): per-track audio and
  album artwork upload, direct to Supabase Storage via server-issued signed
  upload URLs (`app/api/files/sign`, `app/api/files/attach`) — the file
  never passes through a Next.js route handler, so it isn't subject to
  Vercel's serverless body-size limit.
- **Catalog health dashboard** (`/health`): the first albums-list view,
  plus deterministic (no-AI) checks in `lib/catalogHealth.ts` — missing
  ISRC/lyrics/audio/release date, duplicate ISRCs across the whole catalog,
  a tracklist position gap, and artwork below `MIN_ARTWORK_DIMENSION`
  (reads just enough of the image via a Range request to check dimensions,
  doesn't download the whole file). "Run health check"
  (`app/api/health/run`) reconciles findings against `catalog_issues`:
  new problems are inserted, already-tracked ones are left alone, and ones
  that no longer reproduce are auto-resolved — there's no separate
  "dismiss" action, `resolved` just tracks "still true or not." Severity
  (`error` vs `warning`) is my judgment call, not from the product outline
  (which only ever shows ⚠ in its mockup) — duplicate ISRC, missing audio,
  and undersized/missing artwork are `error` (block the "ready for
  migration" banner); missing ISRC/lyrics/release date are `warning`
  (don't block it). Reasoning: those three are the ones that actually
  break a migration outright.
- **Album/track edit screen** (`/albums/edit?id=<albumId>`): fixes the gap
  flagged since the health dashboard shipped — title, artist, release
  date, UPC, genre, source distributor, and per-track title/ISRC/lyrics
  (plain + synced)/credits are all editable on an already-confirmed
  album, not just at import time. Tracks can be added, removed, and
  reordered too, same as the confirm screen. `app/api/albums/update`
  reconciles the submitted tracklist against the DB by track `id` (update
  in place / insert if no `id` / delete if an existing `id` is no longer
  present) rather than replacing the tracks wholesale — replacing would
  mint new ids on every save and silently orphan `catalog_issues` rows and,
  worse, discard `audio_file_url` for tracks whose audio was already
  attached, since this form never touches that column. Reordering writes
  positions in two passes (existing tracks first move to temporary
  negative positions, then everything lands on its final position) to
  avoid tripping the `unique(album_id, position)` constraint when two
  tracks swap places — verified against real data (temporary Supabase
  auth user + album, simultaneous reorder/insert/delete/edit in one save,
  fully deleted afterward) rather than trusted from code review alone.
- **Export pack generator** (`/albums/export?id=<albumId>`): generic,
  driven entirely by `distributor_profiles` — not hardcoded to Ditto.
  Pick a target distributor; if `supports_bulk_csv` it downloads a CSV
  (`app/api/export/csv`, one row per track, album fields repeated per
  row), otherwise it renders a reference sheet (`lib/exportPack.ts`) in
  `export_field_map.fields` order, values click-to-select for copy-paste
  into the distributor's manual form. Fields now carry an optional `step`
  (`types/catalog.ts`) and the reference sheet groups album-level rows
  into one card per step — added once it became clear Ditto's real
  submission is a 5-page wizard (Upload → Details → Schedule → Store →
  Review), not a single form, so a flat field list couldn't actually
  mirror it.
  - **Ditto's "Details" step (2 of 5) is now fully verified** — both the
    release-level section and the per-track "Edit Metadata" panel within
    it, from real screenshots. 31 fields, exact labels and order.
  - **Two things the field list alone doesn't capture, so they're baked
    into the label text itself:** ISRC and Lyrics are toggle-gated on
    the real form ("Who autogenerated this track's ISRC? Enter your
    own?" / "Add lyrics?") — the input only appears after flipping the
    toggle, easy to miss, and ISRC continuity is the one thing this app
    is built to protect. And Ditto's per-track credits are 4 *required*
    categories (Composer; Songwriter + a role like "Lyricist";
    Production/Engineer + a role like "Producer"; Performer + a role
    like "Lead Vocals"), not a freeform list — this app's `Credit` type
    has no fixed categories, so there's no reliable, non-guessing way to
    sort a track's credits into Ditto's 4 buckets automatically. Those 4
    fields are listed blank for manual fill-in, alongside a 5th
    "All credits on file" row kept as a reference dump so the raw data
    is visible while sorting it in by hand.
  - **Also newly discovered: Ditto tracks several fields per-track, not
    just per-release** — mix version, copyright holder/year, even a
    separate primary artist. This app's `Track` type has no equivalent
    for any of them (only release-level `artist`), so they're listed
    blank too, labeled `Track ...` to distinguish them from their
    release-level counterparts in the same sheet.
  - **Schedule (3 of 5) turned out to have two release-date fields, not
    one — caught and corrected, not just added.** "Choose a release
    date" is always visible (a forward-looking scheduling decision for
    the new Ditto listing). Toggling "Has this been released before?" to
    Yes reveals a second, separate "Enter the original release date"
    field. This app's `release_date` is populated from what's shown on
    the *existing* distributor listing during import — historical fact,
    not a forward-looking schedule — so it belongs on "original release
    date". An earlier version of this mapping pointed it at "Choose a
    release date" instead, before that second field was known to exist;
    that was wrong and is now fixed. "Choose a release date" itself has
    no schema equivalent (it's a decision made at migration time, not
    migrated data) and is listed blank.
  - **`upc` is narrowed but still not confirmed** — Upload, Details,
    Schedule, and now Store (checked via both a saved HTML page and two
    screenshots showing it's a DSP checklist plus paid add-ons and a
    per-track pricing tier, nothing else) all have no UPC field. That's
    4 of 5 steps clear; only Review is unseen. Grouped under an explicit
    "Not yet verified — Review (5 of 5) unseen" step, with the label
    stating this is inference from absence, not a confirmed policy
    statement the way DistroKid's terms-based UPC note is.
  - **DistroKid's mapping is now verified too** — 24 fields, from the
    real upload/edit form's saved HTML rather than a screenshot, which
    is a genuinely different confidence profile: field *names* (read
    straight from `name=` attributes and their label text) are as
    reliable as Ditto's, but exact on-screen *order* is less certain —
    the relevant markup carries an `upload-mobile-*` class prefix
    suggesting a possible mobile-layout copy, and the page has no
    wizard/step structure at all (one continuous form, unlike Ditto's 5
    pages). Two things confirmed outright, not left as open questions,
    straight from DistroKid's own page text: **UPC is never
    user-specifiable on any plan** (their own terms: "you can choose to
    specify your own ISRC codes, but not UPC codes"), and **there's no
    lyrics field anywhere on the form** — DistroKid lyrics distribution
    is a separate product, not release metadata — so `track.lyrics_plain`
    has no row at all here, unlike Ditto. Same structured-credits problem
    as Ditto, different shape: DistroKid has its own multi-category
    system (Songwriter real names with a role + first/middle/last name;
    Performer and Producer/Engineer credits, each with a role from a
    large controlled list) that this app's freeform `Credit` type can't
    be reliably auto-sorted into, so — same resolution as Ditto — those
    categories are blank for manual fill-in alongside the reference dump.
- **Migration tracker** (`/migrations`): a per-album status board over
  `migration_records`. Nothing here is inferred from the rest of the app's
  data (deliberately — the health dashboard already owns "is this album
  actually ready," and everything past that point, uploading and
  verifying, happens on the distributor's own site, which this tool never
  touches). `status` and `takedown_status` are plain selects the user
  drives by hand, reporting what they actually did; clicking a status
  jumps straight to it, no enforced ordering, no auto-advance.
  `uploaded_at`/`verified_at` auto-stamp on first arrival at those two
  statuses only (`app/api/migrations/update`) — not overwritten on
  re-selection. "Start tracking" (`app/api/migrations/start`) is
  idempotent on `(album_id, target_distributor_id)`, matching the schema's
  unique constraint, and an album can track migrations to more than one
  target distributor at once.
- **Migration Confidence Score, Preflight, and PDF report** (`/health`,
  `/health/preflight`, "Generate report"): a scoring layer over the existing
  `catalog_issues` — no new detection engine. `lib/migrationScore.ts` starts
  each album at 100, deducts per issue type (Critical: missing ISRC −6/track,
  duplicate ISRC −8/pair, missing audio −6/track, track count mismatch −15
  flat; Important: undersized artwork/missing release date/missing UPC −4-5
  flat; Minor: missing lyrics/songwriter credit −1/track), floors at 0, then
  caps at 79 if any Critical issue remains — so one bad ISRC can't be
  mathed away by forty tracks' worth of minor deductions. Bands: 95-100 Ready
  to Migrate, 80-94 Needs Attention, 0-79 Not Ready. The catalog-level number
  is the mean of album scores, always shown next to the single weakest
  album, not alone. `duplicate_isrc` pairs are approximated as
  `floor(affected tracks / 2)`, since `checkDuplicateIsrcs` stores one row
  per track in the collision, not one per pair — exact for the common
  2-track case. `likely_duplicate_album` carries no deduction (catalog
  hygiene, not migration readiness). Two issue types the scoring spec
  needed didn't exist yet and were added to `lib/catalogHealth.ts`:
  `missing_upc` (album-level) and `missing_songwriter_credit` (per track,
  matched via a case-insensitive substring on `Credit.role` since it's
  freeform text, not an enum) — same pattern as the `missing_release_date` /
  `missing_lyrics` checks already there. Also fixed in passing:
  `likely_duplicate_album` was a valid `IssueType` and something
  `checkLikelyDuplicateAlbums` actually inserted, but was missing from the
  `catalog_issues.issue_type` check constraint — those inserts would have
  failed against a DB built from this file. All copy is worded as data
  readiness ("your data is ready to migrate"), deliberately never as a
  guarantee that streams, playlist placements, or royalties survive the
  actual DSP-side switch, since this tool has no visibility into that once
  the catalog leaves it. Preflight (`/health/preflight?album_id=<id>`, or no
  param for the whole catalog) is a pure presentation layer —
  `buildPreflightSteps()` turns the same unresolved issues into an ordered
  step list, and `PreflightAnimation.tsx` reveals them one at a time on a
  timer, ending on the same score/badge shown on `/health`. The PDF
  (`lib/migrationReportPdf.tsx`, `@react-pdf/renderer`, rendered server-side
  in `app/api/reports/pdf`) is meant as the artist's permanent,
  tool-independent record — every album, track, ISRC, UPC, credit, and the
  validation state at generation time. It prints "Not on file" for copyright
  holder rather than fabricate one — that field is referenced in the Ditto/
  DistroKid export mappings but was never added to the `albums`/`tracks`
  schema itself.
- **Paste Queue browser extension** (`extension/`): a minimal Manifest V3
  Chrome extension that closes the last gap on the export reference sheet —
  no more alt-tabbing back to `/albums/export` to re-read each value while
  filling in a distributor's manual form. `lib/exportPack.ts`'s
  `buildPasteQueue()` flattens an already-built `ExportPack` (same order the
  reference sheet renders) into a `{label, value}[]`, dropping blank rows;
  the export page's new "Paste Queue extension" card
  (`app/albums/export/CopyQueueJsonButton.tsx`) copies that as JSON. Paste it
  into the extension's popup, then a single global hotkey (`Alt+Shift+C` by
  default, `chrome.commands`, rebindable at `chrome://extensions/shortcuts`)
  copies the next field to the clipboard and advances, regardless of which
  window has focus — paste, hotkey, click next field, paste, repeat. v0 loads
  data by pasting a JSON blob rather than fetching an API endpoint, since
  this app has no real per-user auth yet (see the `DEV_USER_ID` note below) —
  designing that just to authorize an extension fetch would be solving the
  wrong problem first. Permissions are `storage`, `clipboardWrite`, and
  `offscreen` — one more than the feature conceptually needs
  (`clipboardWrite`/`commands`), for two forced reasons, not scope creep:
  MV3 service workers are killed after ~30s idle and lose all in-memory
  state, so the queue/index have to live in `chrome.storage.local` or a
  short pause between fields would silently lose your place; and
  `navigator.clipboard.writeText()` isn't callable from a service worker at
  all (no DOM there) — the actual write happens in a short-lived offscreen
  document (`extension/offscreen.html`/`.js`) that `background.js` spins up
  on demand, which is the only reason that file exists. The toolbar badge
  (`4/42`) is the always-visible indicator; the popup adds the next field's
  actual label, since a badge can't fit one. It never reads, inspects, or
  submits anything on the distributor's page — strictly a clipboard
  sequencer the musician drives by hand. See `extension/README.md` for
  load-unpacked steps.
- **v0 auth stand-in:** no login flow yet. Every write goes through the
  admin client and attributes the record to a single `DEV_USER_ID` (see
  `.env.example`) — create that Supabase auth user once, by hand.
- Minimal app shell (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`)
  so the project runs out of the box.

## v0 build order — all six done

1. ~~Universal Import — screenshot path first.~~ Done.
2. ~~Confirm screen.~~ Done.
3. ~~File attachment.~~ Done.
4. ~~Catalog Health Dashboard.~~ Done.
5. ~~Export pack generator.~~ Done.
6. ~~Migration tracker UI.~~ Done.

One thing flagged along the way is now mostly resolved, and the remainder
matters more than anything on the v1 list below:

- **`export_field_map` is verified for both seeded distributors.** Ditto:
  the full "Details" step (2 of 5, release-level and per-track) plus both
  release-date fields on Schedule (3 of 5), from real screenshots — 32
  fields. `upc` is narrowed but not fully closed: Upload, Details,
  Schedule, and Store (4 of 5 steps) all show no UPC field; only Review
  is unseen. DistroKid: 24 fields
  from the real upload/edit form's saved HTML — a different verification
  method than Ditto's screenshots, with correspondingly different
  confidence (field names as reliable as Ditto's; field order less
  certain — see the export pack note above for why). Two DistroKid facts
  confirmed outright rather than left open: UPC is never user-specifiable
  on any plan, and there's no lyrics field on the form at all. This tool
  still can't browse either distributor's site itself — every field here
  came from something you sent, not something fetched.

## Not built yet — v1 (per `docs/product-outline.md` §8)

- ~~CSV/Excel and PDF import paths.~~ Done. Folder import (audio + artwork
  files, no AI — filenames as metadata) is still unbuilt; it's a distinct
  feature (local file access + the existing file-attachment upload
  pipeline) rather than an extension of the CSV/PDF work.
- A second and third distributor export profile
- Generalize the export-profile system past the two hand-seeded rows
- Polish the confirm-screen UX for non-technical users

## Known environment gotchas (carried over from other projects)

- Developing on Windows / Command Prompt.
- **Avoid `[id]`-style dynamic route folders** — square brackets have
  caused Git issues on this setup before. Use static routes with query
  params instead, e.g. `/albums/view?id=xxx` rather than `/albums/[id]`.
- Supabase: custom JWT hook is disabled elsewhere in this portfolio: policies
  needing org-style lookups use a `(SELECT ... FROM users WHERE id =
  auth.uid())` subquery pattern. Not needed here since album ownership is
  direct (`user_id = auth.uid()`), but worth remembering if a
  team/collaborator feature gets added later.
- Deploys via Vercel elsewhere in this portfolio — likely the default
  target here too.

## Getting started

```
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic keys
# Run supabase/schema.sql in the Supabase SQL editor
npm run dev
```
