# Product Outline: Catalog Migration Assistant
*(working title — positioning ideas at the end)*

## 1. The Problem

Independent musicians who use distributors like DistroKid, TuneCore, CD Baby, or Amuse are effectively locked in: cancelling a subscription can mean losing distribution entirely, and switching distributors means manually re-entering every album's metadata — track titles, ISRCs, credits, artwork, release dates — one release at a time, because:

- Most distributors offer **no bulk export** of catalog metadata (only royalty/earnings CSVs, if that).
- Most distributors offer **no public API**.
- The receiving distributor often requires **manual re-entry per release** through a web form, with no bulk import path for smaller accounts.
- Getting metadata wrong (especially ISRCs) risks **losing stream counts and playlist placements** during the switch.

For a catalog of any real size (dozens of albums, hundreds of tracks), this is many hours of tedious, error-prone, high-stakes manual work.

## 2. The Solution

A tool that sits *between* distributors — never logging into or automating against either one — and does three things:

1. **Imports** existing catalog data from whatever the user already has, in whatever form it's in.
2. **Structures, validates, and maintains** it as one clean, distributor-independent master catalog the user owns permanently.
3. **Packages** it back out in whatever shape the *new* distributor needs.

The user remains the one clicking "upload" on the actual distributor's website at every step. The tool never touches a distributor's system directly.

## 3. Core Design Principle: AI Once, Then Never Again

AI is used only where it provides exceptional value: turning unstructured source material (screenshots, PDFs, pasted text) into structured data during import. Once a catalog record is confirmed, it's ordinary structured data — searched, edited, validated, and exported using conventional deterministic software, with no further AI involvement.

This has real consequences beyond neatness:

- **No ongoing AI subscription cost for the user**, and minimal ongoing AI *spend* for you — most import types (folders, CSVs/Excel) don't need AI at all; a plain parser handles them. Vision AI is doing real work only on screenshots, PDFs, and pasted text.
- **A one-time purchase or per-migration price becomes viable**, rather than the subscription model every distributor already forces on musicians — a genuine differentiator, not just a pricing choice.
- **Reliability**: catalog integrity rests on deterministic rules (ISRC format, duplicate detection, file presence) that behave the same way every time, not on a probabilistic model's judgment call.
- **Future-proof ownership**: the catalog remains a portable, usable asset independent of any distributor *or* any AI service still existing.

Other principles carried over from earlier discussion:
- **Human-in-the-loop, always** — no automation logs into or submits to any distributor's platform.
- **Distributor-agnostic core** — support for a new distributor is an additive export profile, not a rebuild.

## 4. How It Works — The Pipeline

### Step 1: Universal Import
The user provides whatever materials they already have, in whatever form:
- Screenshots of distributor pages
- CSV / Excel exports
- PDF release sheets
- Album folders (artwork + audio files)
- Lyrics documents
- Plain text pasted from a distributor site

The system routes each input type appropriately: structured formats (CSVs, folders) go through a plain parser; unstructured formats (screenshots, PDFs, pasted text) go through a vision-capable AI model with a pre-built extraction prompt, invisible to the user. Either way, the output is the same shape: structured album/track records.

### Step 2: Confirm
Extracted data is shown as an **editable table** next to the source material, so the user can catch and fix anything misread — especially ISRCs, where a single wrong character breaks stream-history continuity. Nothing is saved to the permanent catalog until confirmed. This is the last moment AI is involved for that record.

### Step 3: Files
Artwork is uploaded and stored centrally (small files, genuinely needed for display in confirm screens and catalog browsing). Audio is different: master recordings stay on the musician's own computer and are never uploaded. Instead, the user points the tool at a local folder once (per album, or once globally with per-album subfolders); on Chromium browsers the File System Access API verifies each expected file actually exists and reads its filename, size, and format, feeding straight into Catalog Health. On browsers without that API, the same step is a manual self-attestation instead — the user confirms a filename exists rather than the tool verifying it. Either way, only the filename/relative path is recorded against the track, never the file itself.

### Step 4: Catalog Health Dashboard (no AI)
Once records exist, the platform continuously runs deterministic validation across the whole catalog and surfaces a live summary:

```
Catalog Health

✓ 31 Albums
✓ 742 Songs
✓ All ISRCs valid
⚠ 3 Tracks missing lyrics
⚠ 2 Duplicate ISRCs
⚠ 1 Album artwork below required resolution

✓ Catalog ready for migration
```

Users jump straight to flagged records to fix them. Scope stays deliberately limited to catalog-*internal* consistency (format, duplicates, completeness) — checking a record against what's actually live on a distributor's site is a different, harder problem and out of scope for this rule-based layer.

This is also what turns the product from a one-off migration tool into an ongoing catalog management system — there's a reason to keep using it (and keep the catalog current) long after any single migration is done.

### Step 5: Master Catalog
The confirmed, validated, health-checked record lives in the user's permanent, distributor-independent catalog — searchable, editable, exportable, with zero further AI cost.

### Step 6: Distributor Export Packs (no AI)
Each supported distributor has an export profile mapping the master catalog's fields into that distributor's required format:

```
Master Catalog
     │
     ▼
─────────────────────────
 Ditto Export Pack
 TuneCore Export Pack
 CD Baby Export Pack
 LANDR Export Pack
─────────────────────────
```

If the distributor supports bulk CSV import, the platform generates a correctly formatted CSV. If it requires manual entry (like Ditto currently does), it produces a structured reference sheet arranged in the exact order the distributor's upload form asks for fields — copy-paste instead of hunt-and-peck, and far less transcription-error risk.

Adding a new distributor later is "write a new export profile," not "rebuild the platform."

### Step 7: Track Progress
A dashboard shows every album's status: imported → files attached → health-checked → export pack generated → uploaded (user-confirmed) → verified. Where stream-history preservation matters, a parallel status tracks the old distributor's takedown request (requested → processing → cleared).

### Step 8: Verify
After manual upload to the new distributor, the user checks the new listing against the master catalog record and marks it verified.

## 5. What This Saves (Illustrative)

For a catalog of ~30 albums / 750 songs, disregarding the actual upload-to-new-distributor step (which stays manual by design):

| Phase | Estimated active time |
|---|---|
| Import + confirm | 4–6 hrs |
| File retrieval | 3.5–5 hrs |
| Health check review | 0.5–1 hr |
| **Total** | **~8–12 hrs**, roughly a weekend |

## 6. Business Model Implications

Because ongoing use (health dashboard, export packs, catalog editing) costs essentially nothing beyond standard hosting/database — no per-use AI spend — a few pricing shapes become realistic that wouldn't be for an AI-heavy tool:
- **One-time purchase** for a single migration.
- **Per-migration fee** if the user later switches distributors again.
- **Free ongoing catalog management** as a retention hook, with paid export packs as the monetized step.

Any of these undercut the subscription model every distributor already imposes — worth leading with in positioning.

## 7. Product Positioning

Not really a "DistroKid migration tool" — better framed as a **catalog portability / distributor-independence tool** for independent musicians. Distributor lock-in fear (the trigger for this whole idea) is a recurring, relatable pain point across the whole indie-artist market. The pitch: *own a clean, permanent copy of your catalog, validated and ready to go — and switch distributors in hours, not weeks, whenever you need to, without paying for AI every time you touch your own data.*

## 8. Suggested Build Order

1. **v0 (personal use):** Universal import (screenshot + folder, at minimum) → confirm → health check → master catalog → single export profile pair (DistroKid capture → Ditto Music packet). Solve your own migration first.
2. **v1 (product-ready):** Generalize the schema and export-profile system, add CSV/Excel and PDF import paths, add a second and third distributor export profile, polish the confirm-screen UX for non-technical users, add takedown-tracking status.
3. **v2 (growth):** More distributor profiles based on demand, lyrics-document import, a lightweight desktop helper for auto-matching downloaded audio files to catalog entries by filename.
