import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import type { Album, MigrationRecord, DistributorProfile } from "@/types/catalog";
import MigrationRow from "./MigrationRow";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { stepEyebrow } from "@/lib/workflowSteps";

const LINK_BUTTON_SECONDARY =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors bg-transparent border border-ink/20 text-ink hover:bg-ink/[0.04] hover:border-ink/35";

// Reads live catalog/migration state — must not be prerendered as static
// build-time HTML.
export const dynamic = "force-dynamic";

export default async function MigrationsPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const supabase = createAdminClient();

  const { data: albumRows } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const albums = (albumRows ?? []) as Album[];
  const albumIds = albums.map((a) => a.id);

  // Sequential queries, not embedded joins — project convention.
  const [{ data: recordRows }, { data: profileRows }] = await Promise.all([
    albumIds.length
      ? supabase.from("migration_records").select("*").in("album_id", albumIds)
      : Promise.resolve({ data: [] as MigrationRecord[] }),
    supabase.from("distributor_profiles").select("*").order("display_name"),
  ]);
  const records = (recordRows ?? []) as MigrationRecord[];
  const profiles = (profileRows ?? []) as DistributorProfile[];

  const recordsByAlbum = new Map<string, MigrationRecord[]>();
  for (const record of records) {
    const list = recordsByAlbum.get(record.album_id) ?? [];
    list.push(record);
    recordsByAlbum.set(record.album_id, list);
  }

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <PageHeader
          eyebrow={stepEyebrow(5)}
          title="Migration tracker"
          description="Every status here is you reporting something you actually did on the distributor's own site — nothing is auto-detected or automated."
        />

        {profiles.length === 0 && (
          <p className="text-rust">No distributor profiles configured yet — nothing to migrate to.</p>
        )}

        {albums.length === 0 ? (
          <EmptyState
            message="No confirmed albums yet."
            action={
              <Link href="/import" className={LINK_BUTTON_SECONDARY}>
                Import one
              </Link>
            }
          />
        ) : (
          <ul className="space-y-4">
            {albums.map((album) => (
              <li key={album.id}>
                <Card className="p-6">
                  <MigrationRow
                    album={album}
                    records={recordsByAlbum.get(album.id) ?? []}
                    profiles={profiles}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
