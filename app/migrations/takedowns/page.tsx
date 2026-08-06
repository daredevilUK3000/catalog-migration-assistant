import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import type { Album, MigrationRecord, DistributorProfile } from "@/types/catalog";
import TakedownTable, { type TakedownRow } from "./TakedownTable";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

const LINK_BUTTON_SECONDARY =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors bg-transparent border border-ink/20 text-ink hover:bg-ink/[0.04] hover:border-ink/35";

// Reads live migration/takedown state — must not be prerendered.
export const dynamic = "force-dynamic";

export default async function TakedownsPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const supabase = createAdminClient();

  const { data: albumRows } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", userId);
  const albums = (albumRows ?? []) as Album[];
  const albumIds = albums.map((a) => a.id);

  // Sequential queries, not embedded joins — project convention.
  const [{ data: recordRows }, { data: profileRows }] = albumIds.length
    ? await Promise.all([
        supabase.from("migration_records").select("*").in("album_id", albumIds),
        supabase.from("distributor_profiles").select("*").order("display_name"),
      ])
    : [{ data: [] }, { data: [] }];

  const records = (recordRows ?? []) as MigrationRecord[];
  const profiles = (profileRows ?? []) as DistributorProfile[];

  const albumById = new Map(albums.map((a) => [a.id, a]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const rows: TakedownRow[] = records
    .map((record) => {
      const album = albumById.get(record.album_id);
      if (!album) return null;
      return {
        record,
        albumTitle: album.title,
        albumArtist: album.artist,
        sourceName: record.source_distributor_id
          ? (profileById.get(record.source_distributor_id)?.display_name ?? "Unknown source")
          : null,
        targetName: record.target_distributor_id
          ? (profileById.get(record.target_distributor_id)?.display_name ?? "Unknown target")
          : "Unknown target",
      };
    })
    .filter((r): r is TakedownRow => r !== null);

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader
          title="Takedowns"
          description="Requesting a takedown from the source distributor early lets its 2-4 week wait overlap across many albums instead of stacking one at a time."
          actions={
            <Link href="/migrations" className={LINK_BUTTON_SECONDARY}>
              ← Migration tracker
            </Link>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            message="No migrations being tracked yet — start tracking an album's migration from the Migration tracker first, then its takedown status will show up here."
            action={
              <Link href="/migrations" className={LINK_BUTTON_SECONDARY}>
                Go to Migration tracker
              </Link>
            }
          />
        ) : (
          <TakedownTable rows={rows} />
        )}
      </div>
    </main>
  );
}
