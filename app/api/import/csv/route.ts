import { NextRequest, NextResponse } from "next/server";
import { parseCatalogSpreadsheet } from "@/lib/importCsv";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB upload limit.` },
      { status: 400 }
    );
  }

  // Browsers report inconsistent MIME types for CSV/Excel across OS and
  // browser (sometimes text/csv, sometimes application/vnd.ms-excel, even
  // text/plain) — unlike images, that's not a reliable gate here. The
  // filename extension plus the parser's own format detection do the work
  // instead; a genuinely unreadable file fails with a clear parse error.
  const filename = "name" in file && typeof file.name === "string" ? file.name : "upload.csv";
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await parseCatalogSpreadsheet(buffer, filename);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.albums.length === 0) {
    return NextResponse.json(
      { error: "No releases could be parsed from this file." },
      { status: 400 }
    );
  }

  return NextResponse.json({ albums: result.albums, warnings: result.warnings });
}
