import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import type { ExtractedAlbumDraft } from "@/types/catalog";

export const EXTRACTION_PROMPT = `This is a screenshot or document from a music distributor's dashboard (e.g. DistroKid, TuneCore, CD Baby, Amuse) showing one album/release and its tracklist.

Extract the release's metadata and full tracklist exactly as shown. Rules:

- Transcribe ISRCs character-by-character, exactly as displayed. Never guess, normalize, or "correct" an ISRC — a single wrong character breaks stream-history continuity for that track after migration. If an ISRC is not visible or not legible, use null rather than fabricating one.
- Track "position" is the track's 1-indexed order in the tracklist as shown.
- Use null for any field that is not visible. Do not infer or fabricate values (including genre, release date, or UPC) that aren't actually shown.
- release_date, if present, should be normalized to ISO 8601 (YYYY-MM-DD) when the source gives enough precision to do so unambiguously; otherwise return it as shown.
- Return only the album and its tracks — ignore unrelated page chrome, navigation, or other releases that might appear in the same source.`;

export const EXTRACTED_ALBUM_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Album/release title" },
    artist: { type: "string", description: "Primary release artist" },
    release_date: { type: ["string", "null"] },
    upc: { type: ["string", "null"] },
    genre: { type: ["string", "null"] },
    tracks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          position: { type: "integer", description: "1-indexed track order" },
          title: { type: "string" },
          isrc: { type: ["string", "null"] },
        },
        required: ["position", "title", "isrc"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "artist", "release_date", "upc", "genre", "tracks"],
  additionalProperties: false,
} as const;

export type ExtractionResult =
  | { ok: true; draft: ExtractedAlbumDraft }
  | { ok: false; status: number; error: string };

/** Shared by the screenshot and PDF import routes: sends a pre-built
 * image/document content block to Claude with the extraction prompt and
 * schema, and validates the response at this system boundary. */
export async function extractAlbumDraft(
  contentBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam
): Promise<ExtractionResult> {
  const client = getAnthropicClient();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: EXTRACTION_PROMPT }],
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: EXTRACTED_ALBUM_DRAFT_SCHEMA },
      },
    });
  } catch (err) {
    return mapAnthropicError(err);
  }

  if (response.stop_reason === "refusal") {
    return {
      ok: false,
      status: 422,
      error: "The extraction request was declined. Try a clearer or different source.",
    };
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    return { ok: false, status: 502, error: "The model returned no extractable content." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(textBlock.text);
  } catch {
    return { ok: false, status: 502, error: "The model's output was not valid JSON." };
  }

  const draft = toExtractedAlbumDraft(raw);
  if (!draft) {
    return {
      ok: false,
      status: 502,
      error: "Extracted data did not match the expected album shape.",
    };
  }

  return { ok: true, draft };
}

/** Validates the model's parsed JSON at this system boundary and drops nulls to match ExtractedAlbumDraft's optional fields. */
function toExtractedAlbumDraft(raw: unknown): ExtractedAlbumDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.title !== "string" || typeof r.artist !== "string" || !Array.isArray(r.tracks)) {
    return null;
  }

  const tracks: ExtractedAlbumDraft["tracks"] = [];
  for (const item of r.tracks) {
    if (typeof item !== "object" || item === null) return null;
    const t = item as Record<string, unknown>;
    if (typeof t.position !== "number" || typeof t.title !== "string") return null;
    tracks.push({
      position: t.position,
      title: t.title,
      isrc: typeof t.isrc === "string" ? t.isrc : undefined,
    });
  }

  return {
    title: r.title,
    artist: r.artist,
    release_date: typeof r.release_date === "string" ? r.release_date : undefined,
    upc: typeof r.upc === "string" ? r.upc : undefined,
    genre: typeof r.genre === "string" ? r.genre : undefined,
    tracks,
  };
}

function mapAnthropicError(err: unknown): ExtractionResult {
  if (err instanceof Anthropic.RateLimitError) {
    return { ok: false, status: 429, error: "Rate limited by the extraction service. Try again shortly." };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { ok: false, status: 400, error: "The extraction request was rejected as invalid." };
  }
  if (err instanceof Anthropic.APIError) {
    return { ok: false, status: 502, error: "The extraction service failed. Try again." };
  }
  throw err;
}
