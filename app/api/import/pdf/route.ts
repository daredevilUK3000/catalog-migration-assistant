import { NextRequest, NextResponse } from "next/server";
import { extractAlbumDraft } from "@/lib/importExtraction";
import { getCurrentUserId } from "@/lib/auth/currentUser";

export const runtime = "nodejs";

// Same reasoning as the screenshot route's cap: keep well under Vercel's
// default 4.5MB serverless body limit so the failure is a clear 400 rather
// than an opaque platform 413. Release sheets are almost always small
// (mostly text, maybe one image) — Claude's own PDF limit is far higher.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' PDF field." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Uploaded PDF is empty." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `PDF exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB upload limit.` },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: `Unsupported file type '${file.type || "unknown"}'. Use a PDF.` },
      { status: 400 }
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const result = await extractAlbumDraft({
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: base64 },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.draft);
}
