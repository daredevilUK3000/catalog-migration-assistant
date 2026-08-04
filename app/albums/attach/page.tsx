import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import type { Album, Track } from "@/types/catalog";
import AttachFilesForm from "./AttachFilesForm";

export default async function AttachFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) {
    notFound();
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const supabase = createAdminClient();

  const { data: albumRow } = await supabase
    .from("albums")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!albumRow) {
    notFound();
  }
  const album = albumRow as Album;

  // Sequential queries by design (project convention) — embedded PostgREST
  // joins have silently returned empty results in this Supabase setup before.
  const { data: trackRows } = await supabase
    .from("tracks")
    .select("*")
    .eq("album_id", id)
    .order("position");
  const tracks = (trackRows ?? []) as Track[];

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Attach files</h1>
          <p className="mt-1 text-neutral-600">
            {album.title} — {album.artist}
          </p>
        </div>
        <AttachFilesForm album={album} tracks={tracks} />
      </div>
    </main>
  );
}
