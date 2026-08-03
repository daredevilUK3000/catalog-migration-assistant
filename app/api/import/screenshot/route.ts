import { NextRequest, NextResponse } from "next/server";
import { extractAlbumDraft } from "@/lib/importExtraction";

export const runtime = "nodejs";

// Vercel's default serverless body limit is 4.5MB — keep our own check well
// under that so the failure is a clear 400 instead of an opaque platform 413.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

function isSupportedMediaType(value: string): value is SupportedMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an 'image' file field." },
      { status: 400 }
    );
  }

  const file = formData.get("image");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing 'image' file in form data." },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Uploaded image is empty." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `Image exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB upload limit.` },
      { status: 400 }
    );
  }

  if (!isSupportedMediaType(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported image type '${file.type || "unknown"}'. Use JPEG, PNG, GIF, or WebP.`,
      },
      { status: 400 }
    );
  }
  const mediaType = file.type;

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const result = await extractAlbumDraft({
    type: "image",
    source: { type: "base64", media_type: mediaType, data: base64 },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.draft);
}
