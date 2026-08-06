import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { isPremiumUserId } from "@/lib/auth/premium";
import type { Album } from "@/types/catalog";

export const runtime = "nodejs";

type Mode = "skip_existing" | "overwrite_all";

interface BulkApplyGenreBody {
  genre: string;
  mode: Mode;
  dry_run: boolean;
}

function parseBody(raw: unknown): BulkApplyGenreBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const genre = typeof r.genre === "string" ? r.genre.trim() : "";
  if (!genre) return null;

  const mode: Mode = r.mode === "overwrite_all" ? "overwrite_all" : "skip_existing";
  const dryRun = r.dry_run !== false; // default to a safe preview if omitted

  return { genre, mode, dry_run: dryRun };
}

type AlbumSlice = Pick<Album, "id" | "title" | "genre">;

function hasGenre(album: AlbumSlice): boolean {
  return Boolean(album.genre && album.genre.trim() !== "");
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json({ error: "A genre value is required." }, { status: 400 });
  }

  // Applies across the whole catalog at once — same premium gate as the
  // other full-catalog actions (Export Pack, full Catalog Health, the
  // catalog-scope songwriter bulk-apply).
  if (!(await isPremiumUserId(userId))) {
    return NextResponse.json(
      {
        error:
          "Applying across your whole catalog is part of Own Your Music ($49, one-time). Buy at /billing to unlock it.",
      },
      { status: 402 }
    );
  }

  const supabase = createAdminClient();

  const { data: albumRows, error: albumsError } = await supabase
    .from("albums")
    .select("id, title, genre")
    .eq("user_id", userId);
  if (albumsError) {
    return NextResponse.json(
      { error: `Failed to load albums: ${albumsError.message}` },
      { status: 502 }
    );
  }
  const albums = (albumRows ?? []) as AlbumSlice[];

  const alreadySet = albums.filter(hasGenre);
  const missing = albums.filter((a) => !hasGenre(a));
  const toUpdate = body.mode === "overwrite_all" ? albums : missing;

  if (body.dry_run) {
    const overwriteExamples =
      body.mode === "overwrite_all"
        ? alreadySet
            .slice(0, 50)
            .map((a) => ({ album_title: a.title, existing_genre: a.genre as string }))
        : [];

    return NextResponse.json({
      dry_run: true,
      total_albums: albums.length,
      will_update: toUpdate.length,
      will_skip: albums.length - toUpdate.length,
      already_set_count: alreadySet.length,
      overwrite_examples: overwriteExamples,
    });
  }

  // Sequential per-row updates, matching this codebase's convention
  // elsewhere (album/track bulk-apply routes) — catalog sizes here are
  // small enough (tens of albums) that this isn't a performance concern.
  for (const album of toUpdate) {
    const { error } = await supabase.from("albums").update({ genre: body.genre }).eq("id", album.id);
    if (error) {
      return NextResponse.json(
        { error: `Failed to update "${album.title}": ${error.message}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    dry_run: false,
    updated: toUpdate.length,
    skipped: albums.length - toUpdate.length,
  });
}
