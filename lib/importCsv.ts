import readXlsxFile from "read-excel-file/node";
import type { ExtractedAlbumDraft } from "@/types/catalog";

export interface CsvParseResult {
  albums: ExtractedAlbumDraft[];
  warnings: string[];
}
export type ParseOutcome = CsvParseResult | { error: string };

const ALBUM_ALIASES = ["album", "album title", "release", "release title"];
const ARTIST_ALIASES = ["artist", "album artist", "primary artist"];
const RELEASE_DATE_ALIASES = ["release date", "date"];
const UPC_ALIASES = ["upc", "barcode", "upc/barcode", "upc / barcode"];
const GENRE_ALIASES = ["genre"];
const TRACK_TITLE_ALIASES = ["track title", "track", "song title", "song", "title"];
const POSITION_ALIASES = ["position", "track number", "track #", "#", "no."];
const ISRC_ALIASES = ["isrc"];

/** Hand-rolled RFC 4180 parser (quoted fields, "" escaping, embedded
 * commas/newlines) — avoids pulling in a CSV dependency for something this
 * small and well-specified. */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

async function rowsFromBuffer(buffer: Buffer, filename: string): Promise<string[][] | { error: string }> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".xlsx")) {
    try {
      const sheets = await readXlsxFile(buffer);
      const data = sheets[0]?.data ?? [];
      return data.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
    } catch (err) {
      return {
        error: `Could not read this Excel file: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  }

  if (lower.endsWith(".xls")) {
    return {
      error: "Legacy .xls files aren't supported — re-save this file as .xlsx or .csv and try again.",
    };
  }

  // Default: treat as CSV/plain text.
  return parseCsvText(buffer.toString("utf-8"));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function cellAt(row: string[], index: number): string | undefined {
  if (index === -1) return undefined;
  const value = row[index];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Groups flat rows into one ExtractedAlbumDraft per (album, artist) pair —
 * the same shape the AI extraction paths produce, so the result can feed
 * the existing confirm UI unchanged. No AI involved: unrecognized column
 * headers fail loudly with what was expected and what was found, rather
 * than guessing. */
export async function parseCatalogSpreadsheet(buffer: Buffer, filename: string): Promise<ParseOutcome> {
  const rowsResult = await rowsFromBuffer(buffer, filename);
  if ("error" in rowsResult) return rowsResult;

  const rows = rowsResult.filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    return { error: "No data rows found — the file needs a header row plus at least one release row." };
  }

  const [headerRow, ...dataRows] = rows;
  const albumIdx = findColumnIndex(headerRow, ALBUM_ALIASES);
  const artistIdx = findColumnIndex(headerRow, ARTIST_ALIASES);
  const trackIdx = findColumnIndex(headerRow, TRACK_TITLE_ALIASES);

  const missing: string[] = [];
  if (albumIdx === -1) missing.push("album title (e.g. 'Album', 'Release Title')");
  if (artistIdx === -1) missing.push("artist (e.g. 'Artist')");
  if (trackIdx === -1) missing.push("track title (e.g. 'Track Title', 'Track')");
  if (missing.length > 0) {
    return {
      error: `Couldn't find required columns: ${missing.join(", ")}. Found headers: ${headerRow.join(", ")}.`,
    };
  }

  const releaseDateIdx = findColumnIndex(headerRow, RELEASE_DATE_ALIASES);
  const upcIdx = findColumnIndex(headerRow, UPC_ALIASES);
  const genreIdx = findColumnIndex(headerRow, GENRE_ALIASES);
  const positionIdx = findColumnIndex(headerRow, POSITION_ALIASES);
  const isrcIdx = findColumnIndex(headerRow, ISRC_ALIASES);

  const groups = new Map<string, ExtractedAlbumDraft>();
  const order: string[] = [];
  const warnings: string[] = [];

  dataRows.forEach((row, i) => {
    const albumTitle = cellAt(row, albumIdx);
    const artist = cellAt(row, artistIdx);
    const trackTitle = cellAt(row, trackIdx);

    if (!albumTitle || !artist || !trackTitle) {
      warnings.push(`Row ${i + 2}: missing album, artist, or track title — skipped.`);
      return;
    }

    const key = JSON.stringify([albumTitle, artist]);
    let draft = groups.get(key);
    if (!draft) {
      draft = {
        title: albumTitle,
        artist,
        release_date: cellAt(row, releaseDateIdx),
        upc: cellAt(row, upcIdx),
        genre: cellAt(row, genreIdx),
        tracks: [],
      };
      groups.set(key, draft);
      order.push(key);
    }

    const rawPosition = cellAt(row, positionIdx);
    const parsedPosition = rawPosition ? Number.parseInt(rawPosition, 10) : NaN;
    const position =
      Number.isFinite(parsedPosition) && parsedPosition > 0 ? parsedPosition : draft.tracks.length + 1;

    draft.tracks.push({
      position,
      title: trackTitle,
      isrc: cellAt(row, isrcIdx),
    });
  });

  if (order.length === 0) {
    return { error: "No valid release rows found — every row was missing a required field." };
  }

  const albums = order.map((key) => groups.get(key) as ExtractedAlbumDraft);
  return { albums, warnings };
}
