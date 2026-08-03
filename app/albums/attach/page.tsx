import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createR2ReadUrl } from "@/lib/r2/storage";
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

  const supabase = createAdminClient();

  const { data: albumRow } = await supabase
    .from("albums")
    .select("*")
    .eq("id", id)
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

  // tracks.audio_file_url holds an R2 object key, not a usable URL, once
  // audio is attached (the bucket is private) — resolve a fresh signed read
  // URL per track before handing anything to the client component.
  const resolvedTracks = await Promise.all(
    tracks.map(async (track) => {
      if (!track.audio_file_url) return track;
      try {
        const url = await createR2ReadUrl(track.audio_file_url);
        return { ...track, audio_file_url: url };
      } catch {
        return { ...track, audio_file_url: null };
      }
    })
  );

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Attach files</h1>
          <p className="mt-1 text-neutral-600">
            {album.title} — {album.artist}
          </p>
        </div>
        <AttachFilesForm album={album} tracks={resolvedTracks} />
      </div>
    </main>
  );
}
