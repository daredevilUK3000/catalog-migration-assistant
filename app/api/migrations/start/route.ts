import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MigrationRecord } from "@/types/catalog";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

  const albumId = body.album_id;
  const targetSlug = body.target_distributor_slug;
  const sourceSlug = body.source_distributor_slug;

  if (typeof albumId !== "string" || !albumId) {
    return NextResponse.json({ error: "album_id is required." }, { status: 400 });
  }
  if (typeof targetSlug !== "string" || !targetSlug) {
    return NextResponse.json({ error: "target_distributor_slug is required." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("id")
    .eq("id", albumId)
    .maybeSingle();
  if (albumError || !album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from("distributor_profiles")
    .select("id")
    .eq("slug", targetSlug)
    .maybeSingle();
  if (targetError || !targetProfile) {
    return NextResponse.json({ error: "Target distributor not found." }, { status: 404 });
  }

  let sourceProfileId: string | null = null;
  if (typeof sourceSlug === "string" && sourceSlug) {
    const { data: sourceProfile } = await supabase
      .from("distributor_profiles")
      .select("id")
      .eq("slug", sourceSlug)
      .maybeSingle();
    sourceProfileId = sourceProfile?.id ?? null;
  }

  // Idempotent: (album_id, target_distributor_id) is unique, so re-clicking
  // "start tracking" for the same pair returns the existing record rather
  // than erroring on the constraint.
  const { data: existing } = await supabase
    .from("migration_records")
    .select("*")
    .eq("album_id", albumId)
    .eq("target_distributor_id", targetProfile.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ record: existing as MigrationRecord });
  }

  const { data: created, error: insertError } = await supabase
    .from("migration_records")
    .insert({
      album_id: albumId,
      target_distributor_id: targetProfile.id,
      source_distributor_id: sourceProfileId,
    })
    .select("*")
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: `Failed to start migration: ${insertError?.message ?? "unknown error"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ record: created as MigrationRecord });
}
