import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { buildExportPack, buildPasteQueue, type ExportRow } from "@/lib/exportPack";
import type { Album, Track, DistributorProfile } from "@/types/catalog";
import CopyQueueJsonButton from "./CopyQueueJsonButton";

// Reads live catalog state — must not be prerendered as static build-time HTML.
export const dynamic = "force-dynamic";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; distributor?: string }>;
}) {
  const { id, distributor } = await searchParams;
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

  // Sequential queries, not embedded joins — project convention.
  const [{ data: trackRows }, { data: profileRows }] = await Promise.all([
    supabase.from("tracks").select("*").eq("album_id", id).order("position"),
    supabase.from("distributor_profiles").select("*").order("display_name"),
  ]);
  const tracks = (trackRows ?? []) as Track[];
  const profiles = (profileRows ?? []) as DistributorProfile[];

  const selectedProfile = distributor ? (profiles.find((p) => p.slug === distributor) ?? null) : null;

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Export pack</h1>
          <p className="mt-1 text-neutral-600">
            {album.title} — {album.artist}
          </p>
        </div>

        <form
          method="get"
          className="flex items-end gap-3 rounded-lg border border-neutral-200 bg-white p-6"
        >
          <input type="hidden" name="id" value={id} />
          <label className="flex-1 text-sm">
            <span className="block text-neutral-700">Target distributor</span>
            <select
              name="distributor"
              defaultValue={distributor ?? ""}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5"
            >
              <option value="" disabled>
                Choose a distributor…
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            View export pack
          </button>
        </form>

        {profiles.length === 0 && (
          <p className="text-neutral-600">No distributor profiles configured yet.</p>
        )}

        {distributor && !selectedProfile && (
          <p className="text-red-600">Unknown distributor &quot;{distributor}&quot;.</p>
        )}

        {selectedProfile && (
          <ExportPackView profile={selectedProfile} album={album} tracks={tracks} albumId={id} />
        )}
      </div>
    </main>
  );
}

function ExportPackView({
  profile,
  album,
  tracks,
  albumId,
}: {
  profile: DistributorProfile;
  album: Album;
  tracks: Track[];
  albumId: string;
}) {
  const fields = profile.export_field_map.fields ?? [];

  if (fields.length === 0) {
    return (
      <p className="text-neutral-600">
        {profile.display_name} has no field mapping configured yet, so there&apos;s nothing to
        generate. Populate <code className="text-xs">distributor_profiles.export_field_map</code> for
        this distributor.
      </p>
    );
  }

  if (profile.supports_bulk_csv) {
    return (
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <p className="text-neutral-700">
          {profile.display_name} accepts bulk CSV import — download a ready-to-upload file.
        </p>
        <a
          href={`/api/export/csv?id=${albumId}&distributor=${profile.slug}`}
          className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Download CSV
        </a>
      </div>
    );
  }

  const pack = buildExportPack(profile, album, tracks);

  return (
    <div className="space-y-6">
      <p className="text-neutral-600">
        {profile.display_name} has no bulk import — here&apos;s a reference sheet in the same order
        as their submission form. Click a value to select it for copy-paste.
      </p>

      {pack.albumSections.map((section) => (
        <div key={section.step} className="space-y-1 rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="mb-2 text-sm font-medium text-neutral-700">{section.step}</h2>
          <dl className="divide-y divide-neutral-100">
            {section.rows.map((row, i) => (
              <FieldRow key={i} row={row} />
            ))}
          </dl>
        </div>
      ))}

      {pack.trackSections.map((section) => (
        <div
          key={section.track.id}
          className="space-y-1 rounded-lg border border-neutral-200 bg-white p-6"
        >
          <h2 className="mb-2 text-sm font-medium text-neutral-700">
            Track {section.track.position} — {section.track.title}
          </h2>
          <dl className="divide-y divide-neutral-100">
            {section.rows.map((row, i) => (
              <FieldRow key={i} row={row} />
            ))}
          </dl>
        </div>
      ))}

      <PasteQueueCard profile={profile} album={album} pack={pack} />
    </div>
  );
}

function PasteQueueCard({
  profile,
  album,
  pack,
}: {
  profile: DistributorProfile;
  album: Album;
  pack: ReturnType<typeof buildExportPack>;
}) {
  const queueFields = buildPasteQueue(pack);
  const json = JSON.stringify(
    { album: `${album.title} — ${album.artist}`, distributor: profile.display_name, fields: queueFields },
    null,
    2
  );

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-6">
      <div>
        <h2 className="text-sm font-medium text-neutral-700">Paste Queue extension</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {queueFields.length} field{queueFields.length === 1 ? "" : "s"} with a value to fill in.
          Copy this JSON and paste it into the Paste Queue extension&apos;s popup, then use its
          hotkey to copy one field at a time straight into {profile.display_name}&apos;s form —
          no more alt-tabbing back here to re-read a value.
        </p>
      </div>
      <CopyQueueJsonButton json={json} />
      <textarea
        readOnly
        value={json}
        rows={6}
        className="w-full rounded border border-neutral-300 bg-neutral-50 p-2 font-mono text-xs text-neutral-700"
      />
    </div>
  );
}

function FieldRow({ row }: { row: ExportRow }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="w-1/3 shrink-0 text-sm text-neutral-500">{row.label}</dt>
      <dd className="flex-1 select-all text-sm text-neutral-900">
        {row.value || <span className="text-neutral-400">—</span>}
      </dd>
    </div>
  );
}
