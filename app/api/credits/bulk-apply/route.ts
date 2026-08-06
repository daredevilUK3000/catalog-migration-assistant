import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { isPremiumUserId } from "@/lib/auth/premium";
import { isSongwriterCredit, hasSongwriterCredit } from "@/lib/credits";
import type { Album, Track, Credit } from "@/types/catalog";

export const runtime = "nodejs";

type Mode = "skip_existing" | "overwrite_all";

interface BulkApplyBody {
  scope: "catalog" | "album";
  album_id: string | null;
  name: string;
  role: string;
  mode: Mode;
  dry_run: boolean;
}

function parseBody(raw: unknown): BulkApplyBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const scope = r.scope === "catalog" || r.scope === "album" ? r.scope : null;
  if (!scope) return null;

  const albumId = typeof r.album_id === "string" && r.album_id ? r.album_id : null;
  if (scope === "album" && !albumId) return null;

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;

  const roleRaw = typeof r.role === "string" ? r.role.trim() : "";
  const role = roleRaw || "Songwriter";

  const mode: Mode = r.mode === "overwrite_all" ? "overwrite_all" : "skip_existing";
  const dryRun = r.dry_run !== false; // default to a safe preview if omitted

  return { scope, album_id: albumId, name, role, mode, dry_run: dryRun };
}

interface OverwriteExample {
  album_title: string;
  track_title: string;
  position: number;
  existing_names: string;
}

/** Replaces every existing songwriter-role credit on a track with a single
 * new one, leaving non-songwriter credits (producer, performer) untouched. */
function applyOverwrite(credits: Credit[], role: string, name: string): Credit[] {
  return [...credits.filter((c) => !isSongwriterCredit(c)), { role, name }];
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
    return NextResponse.json(
      { error: "Missing or invalid fields. A songwriter name and a valid scope are required." },
      { status: 400 }
    );
  }

  // Catalog-wide bulk apply touches every album at once — same premium gate
  // as the other full-catalog actions (Export Pack, Report PDF, full Catalog
  // Health). A single-album apply stays free, matching Edit/Attach files.
  if (body.scope === "catalog" && !(await isPremiumUserId(userId))) {
    return NextResponse.json(
      { error: "Applying across your whole catalog is part of Own Your Music ($49, one-time). Buy at /billing to unlock it." },
      { status: 402 }
    );
  }

  const supabase = createAdminClient();

  let albums: Album[];
  if (body.scope === "album") {
    const { data: album, error: albumError } = await supabase
      .from("albums")
      .select("*")
      .eq("id", body.album_id as string)
      .eq("user_id", userId)
      .maybeSingle();
    if (albumError || !album) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
    albums = [album as Album];
  } else {
    const { data: albumRows, error: albumsError } = await supabase
      .from("albums")
      .select("*")
      .eq("user_id", userId);
    if (albumsError) {
      return NextResponse.json(
        { error: `Failed to load albums: ${albumsError.message}` },
        { status: 502 }
      );
    }
    albums = (albumRows ?? []) as Album[];
  }

  if (albums.length === 0) {
    return NextResponse.json({
      dry_run: body.dry_run,
      total_tracks: 0,
      will_update: 0,
      will_skip: 0,
      overwrite_examples: [],
      updated: 0,
      skipped: 0,
      issues_resolved: 0,
    });
  }

  const albumsById = new Map(albums.map((a) => [a.id, a]));
  const albumIds = albums.map((a) => a.id);

  const { data: trackRows, error: tracksError } = await supabase
    .from("tracks")
    .select("*")
    .in("album_id", albumIds);
  if (tracksError) {
    return NextResponse.json(
      { error: `Failed to load tracks: ${tracksError.message}` },
      { status: 502 }
    );
  }
  const tracks = (trackRows ?? []) as Track[];

  const alreadyCredited = tracks.filter(hasSongwriterCredit);
  const uncredited = tracks.filter((t) => !hasSongwriterCredit(t));

  const toUpdate = body.mode === "overwrite_all" ? tracks : uncredited;
  const toSkip = body.mode === "overwrite_all" ? [] : alreadyCredited;

  if (body.dry_run) {
    const overwriteExamples: OverwriteExample[] =
      body.mode === "overwrite_all"
        ? alreadyCredited.slice(0, 50).map((t) => ({
            album_title: albumsById.get(t.album_id)?.title ?? "—",
            track_title: t.title,
            position: t.position,
            existing_names: t.credits.filter(isSongwriterCredit).map((c) => c.name).join(", "),
          }))
        : [];

    return NextResponse.json({
      dry_run: true,
      total_tracks: tracks.length,
      will_update: toUpdate.length,
      will_skip: toSkip.length,
      already_credited_count: alreadyCredited.length,
      overwrite_examples: overwriteExamples,
    });
  }

  // Sequential per-row updates, matching this codebase's convention
  // elsewhere (app/api/albums/update) — each track's new credits array is
  // computed from its own existing credits, so a single batched query
  // can't express it anyway.
  for (const track of toUpdate) {
    const newCredits =
      body.mode === "overwrite_all"
        ? applyOverwrite(track.credits, body.role, body.name)
        : [...track.credits, { role: body.role, name: body.name }];

    const { error } = await supabase
      .from("tracks")
      .update({ credits: newCredits })
      .eq("id", track.id);
    if (error) {
      return NextResponse.json(
        { error: `Failed to update "${track.title}": ${error.message}` },
        { status: 502 }
      );
    }
  }

  // Recalculate Catalog Health immediately: resolve any still-open
  // missing_songwriter_credit findings for the tracks just credited, rather
  // than waiting on a manual "Run health check" re-run.
  let issuesResolved = 0;
  const updatedTrackIds = toUpdate.map((t) => t.id);
  if (updatedTrackIds.length > 0) {
    const { data: resolvedRows, error: resolveError } = await supabase
      .from("catalog_issues")
      .update({ resolved: true })
      .eq("issue_type", "missing_songwriter_credit")
      .eq("resolved", false)
      .in("track_id", updatedTrackIds)
      .select("id");
    if (resolveError) {
      return NextResponse.json(
        { error: `Credits saved, but failed to refresh catalog health: ${resolveError.message}` },
        { status: 502 }
      );
    }
    issuesResolved = resolvedRows?.length ?? 0;
  }

  return NextResponse.json({
    dry_run: false,
    updated: toUpdate.length,
    skipped: toSkip.length,
    issues_resolved: issuesResolved,
  });
}
