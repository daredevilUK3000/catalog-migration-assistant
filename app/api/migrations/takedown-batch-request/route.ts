import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { DEFAULT_TAKEDOWN_MIN_DAYS, DEFAULT_TAKEDOWN_MAX_DAYS } from "@/lib/takedownEstimate";
import type { MigrationRecord } from "@/types/catalog";

export const runtime = "nodejs";

interface BatchRequestBody {
  record_ids: string[];
  estimated_days_min: number;
  estimated_days_max: number;
}

function parseBody(raw: unknown): BatchRequestBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.record_ids) || r.record_ids.length === 0) return null;
  const recordIds = r.record_ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (recordIds.length === 0) return null;

  const min =
    typeof r.estimated_days_min === "number" && Number.isFinite(r.estimated_days_min)
      ? Math.max(0, Math.round(r.estimated_days_min))
      : DEFAULT_TAKEDOWN_MIN_DAYS;
  const max =
    typeof r.estimated_days_max === "number" && Number.isFinite(r.estimated_days_max)
      ? Math.max(min, Math.round(r.estimated_days_max))
      : Math.max(min, DEFAULT_TAKEDOWN_MAX_DAYS);

  return { record_ids: recordIds, estimated_days_min: min, estimated_days_max: max };
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
      { error: "record_ids (non-empty array) is required." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Ownership + eligibility check in one query: join migration_records to
  // the user's own albums, and only touch records still sitting at
  // not_requested — re-selecting an already-requested/processing/cleared
  // record is a no-op here rather than an error, same "skip what's already
  // handled" convention as the other bulk-apply routes.
  const { data: albumRows, error: albumsError } = await supabase
    .from("albums")
    .select("id")
    .eq("user_id", userId);
  if (albumsError) {
    return NextResponse.json(
      { error: `Failed to load albums: ${albumsError.message}` },
      { status: 502 }
    );
  }
  const ownedAlbumIds = new Set((albumRows ?? []).map((a) => a.id as string));

  const { data: recordRows, error: recordsError } = await supabase
    .from("migration_records")
    .select("id, album_id, takedown_status")
    .in("id", body.record_ids);
  if (recordsError) {
    return NextResponse.json(
      { error: `Failed to load migration records: ${recordsError.message}` },
      { status: 502 }
    );
  }
  const records = (recordRows ?? []) as Pick<
    MigrationRecord,
    "id" | "album_id" | "takedown_status"
  >[];

  const eligibleIds = records
    .filter((r) => ownedAlbumIds.has(r.album_id) && r.takedown_status === "not_requested")
    .map((r) => r.id);

  if (eligibleIds.length === 0) {
    return NextResponse.json({ updated: 0, skipped: body.record_ids.length });
  }

  const { error: updateError } = await supabase
    .from("migration_records")
    .update({
      takedown_status: "requested",
      requested_at: new Date().toISOString(),
      estimated_days_min: body.estimated_days_min,
      estimated_days_max: body.estimated_days_max,
    })
    .in("id", eligibleIds);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update migration records: ${updateError.message}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    updated: eligibleIds.length,
    skipped: body.record_ids.length - eligibleIds.length,
  });
}
