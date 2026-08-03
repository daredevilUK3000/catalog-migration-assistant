"use client";

import { useState } from "react";
import Image from "next/image";
import type { Album, Track } from "@/types/catalog";
import { uploadCatalogFile } from "@/lib/uploadFile";

const ARTWORK_ACCEPT = "image/jpeg,image/png,image/webp";
const AUDIO_ACCEPT = "audio/mpeg,audio/wav,audio/x-wav,audio/flac,audio/mp4,audio/aac,audio/ogg";

type UploadStatus = "idle" | "uploading" | "error";

export default function AttachFilesForm({ album, tracks }: { album: Album; tracks: Track[] }) {
  const [artworkUrl, setArtworkUrl] = useState(album.artwork_url);
  const [artworkStatus, setArtworkStatus] = useState<UploadStatus>("idle");
  const [artworkError, setArtworkError] = useState<string | null>(null);

  const [audioUrls, setAudioUrls] = useState<Record<string, string | null>>(
    Object.fromEntries(tracks.map((t) => [t.id, t.audio_file_url]))
  );
  const [trackStatus, setTrackStatus] = useState<Record<string, UploadStatus>>({});
  const [trackErrors, setTrackErrors] = useState<Record<string, string | null>>({});

  async function handleArtworkChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setArtworkStatus("uploading");
    setArtworkError(null);
    try {
      const url = await uploadCatalogFile({ kind: "artwork", albumId: album.id, file });
      setArtworkUrl(url);
      setArtworkStatus("idle");
    } catch (err) {
      setArtworkStatus("error");
      setArtworkError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      e.target.value = "";
    }
  }

  async function handleTrackAudioChange(track: Track, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setTrackStatus((prev) => ({ ...prev, [track.id]: "uploading" }));
    setTrackErrors((prev) => ({ ...prev, [track.id]: null }));
    try {
      const url = await uploadCatalogFile({
        kind: "audio",
        albumId: album.id,
        trackId: track.id,
        file,
      });
      setAudioUrls((prev) => ({ ...prev, [track.id]: url }));
      setTrackStatus((prev) => ({ ...prev, [track.id]: "idle" }));
    } catch (err) {
      setTrackStatus((prev) => ({ ...prev, [track.id]: "error" }));
      setTrackErrors((prev) => ({
        ...prev,
        [track.id]: err instanceof Error ? err.message : "Upload failed.",
      }));
    } finally {
      e.target.value = "";
    }
  }

  const attachedCount = tracks.filter((t) => audioUrls[t.id]).length;

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-medium text-neutral-700">Artwork</h2>
        <div className="flex items-center gap-4">
          {artworkUrl ? (
            <Image
              src={artworkUrl}
              alt={`${album.title} artwork`}
              width={96}
              height={96}
              className="h-24 w-24 rounded object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded border border-dashed border-neutral-300 text-center text-xs text-neutral-400">
              No artwork
            </div>
          )}
          <div className="space-y-1">
            <input
              type="file"
              accept={ARTWORK_ACCEPT}
              onChange={handleArtworkChange}
              disabled={artworkStatus === "uploading"}
              className="block text-sm text-neutral-600 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            {artworkStatus === "uploading" && (
              <p className="text-sm text-neutral-500">Uploading…</p>
            )}
            {artworkError && <p className="text-sm text-red-600">{artworkError}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Track audio</h2>
          <span className="text-sm text-neutral-500">
            {attachedCount} / {tracks.length} attached
          </span>
        </div>

        <ul className="divide-y divide-neutral-100">
          {tracks.map((track) => {
            const status = trackStatus[track.id] ?? "idle";
            const url = audioUrls[track.id];
            return (
              <li key={track.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-900">
                    {track.position}. {track.title}
                  </p>
                  {url ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio controls src={url} className="mt-1 h-8 w-full max-w-xs" />
                  ) : (
                    <p className="text-xs text-neutral-400">No audio attached</p>
                  )}
                  {trackErrors[track.id] && (
                    <p className="text-sm text-red-600">{trackErrors[track.id]}</p>
                  )}
                </div>
                <label className="shrink-0">
                  <span className="sr-only">Upload audio for {track.title}</span>
                  <input
                    type="file"
                    accept={AUDIO_ACCEPT}
                    disabled={status === "uploading"}
                    onChange={(e) => handleTrackAudioChange(track, e)}
                    className="block text-sm text-neutral-600 file:mr-2 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  />
                  {status === "uploading" && (
                    <span className="mt-1 block text-xs text-neutral-500">Uploading…</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
