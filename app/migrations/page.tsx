import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import type { Album, MigrationRecord, DistributorProfile } from "@/types/catalog";
import MigrationRow from "./MigrationRow";

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
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Migration tracker</h1>
          <p className="mt-1 text-neutral-600">
            Every status here is you reporting something you actually did on the distributor&apos;s
            own site — nothing is auto-detected or automated.
          </p>
        </div>

        {profiles.length === 0 && (
          <p className="text-amber-700">
            No distributor profiles configured yet — nothing to migrate to.
          </p>
        )}

        {albums.length === 0 ? (
          <p className="text-neutral-600">
            No confirmed albums yet.{" "}
            <Link href="/import" className="underline">
              Import one
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <ul className="space-y-4">
            {albums.map((album) => (
              <li key={album.id} className="rounded-lg border border-neutral-200 bg-white p-6">
                <MigrationRow
                  album={album}
                  records={recordsByAlbum.get(album.id) ?? []}
                  profiles={profiles}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
