import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { ownsAlbum } from "@/lib/auth/ownership";
import type { MigrationRecord, MigrationStatus, TakedownStatus } from "@/types/catalog";
import { DEFAULT_TAKEDOWN_MIN_DAYS, DEFAULT_TAKEDOWN_MAX_DAYS } from "@/lib/takedownEstimate";

export const runtime = "nodejs";

const VALID_STATUSES: MigrationStatus[] = [
  "imported",
  "files_attached",
  "health_checked",
  "export_pack_generated",
  "uploaded",
  "verified",
];
const VALID_TAKEDOWN_STATUSES: TakedownStatus[] = [
  "not_requested",
  "requested",
  "processing",
  "cleared",
];

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

  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const id = body.id;
  const status = body.status;
  const takedownStatus = body.takedown_status;

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status as MigrationStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (
    takedownStatus !== undefined &&
    !VALID_TAKEDOWN_STATUSES.includes(takedownStatus as TakedownStatus)
  ) {
    return NextResponse.json({ error: "Invalid takedown_status." }, { status: 400 });
  }
  if (status === undefined && takedownStatus === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("migration_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !existing) {
    return NextResponse.json({ error: "Migration record not found." }, { status: 404 });
  }
  if (!(await ownsAlbum(supabase, existing.album_id, userId))) {
    return NextResponse.json({ error: "Migration record not found." }, { status: 404 });
  }

  // Nothing in this app can observe the real distributor's site — status is
  // always the user reporting a real-world action they already took. All we
  // add is stamping the timestamp columns the schema pairs with those two
  // specific statuses, and only on first arrival so re-selecting the same
  // status doesn't clobber the original time.
  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
    if (status === "uploaded" && !existing.uploaded_at) {
      updates.uploaded_at = new Date().toISOString();
    }
    if (status === "verified" && !existing.verified_at) {
      updates.verified_at = new Date().toISOString();
    }
  }
  if (takedownStatus !== undefined) {
    updates.takedown_status = takedownStatus;
    if (takedownStatus === "requested" && !existing.requested_at) {
      updates.requested_at = new Date().toISOString();
      // Only seed a default window if one isn't already there (e.g. from a
      // batch request that supplied its own, or set previously and then
      // reset) — the batch-request route sets these explicitly itself.
      if (existing.estimated_days_min == null) updates.estimated_days_min = DEFAULT_TAKEDOWN_MIN_DAYS;
      if (existing.estimated_days_max == null) updates.estimated_days_max = DEFAULT_TAKEDOWN_MAX_DAYS;
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("migration_records")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: `Failed to update migration: ${updateError?.message ?? "unknown error"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ record: updated as MigrationRecord });
}
