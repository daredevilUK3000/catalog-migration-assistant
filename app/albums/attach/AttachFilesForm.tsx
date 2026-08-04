"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Album, Track } from "@/types/catalog";
import { uploadArtworkFile } from "@/lib/uploadFile";
import {
  isLocalFileVerificationSupported,
  pickAudioFolder,
  listAudioFiles,
  formatBytes,
  type LocalAudioFile,
} from "@/lib/localAudio";

const ARTWORK_ACCEPT = "image/jpeg,image/png,image/webp";

type UploadStatus = "idle" | "uploading" | "error";
type SaveStatus = "idle" | "saving" | "error";

export default function AttachFilesForm({ album, tracks }: { album: Album; tracks: Track[] }) {
  const [artworkUrl, setArtworkUrl] = useState(album.artwork_url);
  const [artworkStatus, setArtworkStatus] = useState<UploadStatus>("idle");
  const [artworkError, setArtworkError] = useState<string | null>(null);

  const [audioRefs, setAudioRefs] = useState<Record<string, string | null>>(
    Object.fromEntries(tracks.map((t) => [t.id, t.audio_file_url]))
  );
  const [trackStatus, setTrackStatus] = useState<Record<string, SaveStatus>>({});
  const [trackErrors, setTrackErrors] = useState<Record<string, string | null>>({});

  const [supportsLocalVerification, setSupportsLocalVerification] = useState<boolean | null>(null);
  useEffect(() => {
    setSupportsLocalVerification(isLocalFileVerificationSupported());
  }, []);

  const [folderFiles, setFolderFiles] = useState<LocalAudioFile[] | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Record<string, string>>({});

  const [manualFilename, setManualFilename] = useState<Record<string, string>>({});
  const [manualConfirmed, setManualConfirmed] = useState<Record<string, boolean>>({});

  async function handleArtworkChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setArtworkStatus("uploading");
    setArtworkError(null);
    try {
      const url = await uploadArtworkFile({ albumId: album.id, file });
      setArtworkUrl(url);
      setArtworkStatus("idle");
    } catch (err) {
      setArtworkStatus("error");
      setArtworkError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      e.target.value = "";
    }
  }

  async function handlePickFolder() {
    setFolderError(null);
    try {
      const dir = await pickAudioFolder();
      const files = await listAudioFiles(dir);
      setFolderFiles(files);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFolderError(err instanceof Error ? err.message : "Could not read the selected folder.");
    }
  }

  async function saveReference(track: Track, reference: string | null) {
    setTrackStatus((prev) => ({ ...prev, [track.id]: "saving" }));
    setTrackErrors((prev) => ({ ...prev, [track.id]: null }));
    try {
      const res = await fetch("/api/tracks/audio-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ album_id: album.id, track_id: track.id, reference }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save the audio reference.");
      setAudioRefs((prev) => ({ ...prev, [track.id]: body.reference }));
      setTrackStatus((prev) => ({ ...prev, [track.id]: "idle" }));
    } catch (err) {
      setTrackStatus((prev) => ({ ...prev, [track.id]: "error" }));
      setTrackErrors((prev) => ({
        ...prev,
        [track.id]: err instanceof Error ? err.message : "Save failed.",
      }));
    }
  }

  const attachedCount = tracks.filter((t) => audioRefs[t.id]).length;

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
            {attachedCount} / {tracks.length} verified
          </span>
        </div>
        <p className="text-xs text-neutral-500">
          Your master audio files stay on your own computer. We verify they exist and are
          correctly matched to your catalog — we just never store or upload them ourselves.
        </p>

        {supportsLocalVerification === null ? null : supportsLocalVerification ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePickFolder}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
              >
                {folderFiles ? "Change local folder" : "Choose local audio folder"}
              </button>
              {folderFiles && (
                <span className="text-sm text-neutral-500">
                  {folderFiles.length} audio file{folderFiles.length === 1 ? "" : "s"} found
                </span>
              )}
            </div>
            {folderError && <p className="text-sm text-red-600">{folderError}</p>}

            <ul className="divide-y divide-neutral-100">
              {tracks.map((track) => {
                const status = trackStatus[track.id] ?? "idle";
                const reference = audioRefs[track.id];
                const matchedFile = folderFiles?.find((f) => f.relativePath === reference);
                return (
                  <li key={track.id} className="space-y-2 py-3">
                    <p className="truncate text-sm text-neutral-900">
                      {track.position}. {track.title}
                    </p>
                    {reference ? (
                      <p className="text-xs text-emerald-700">
                        Verified: {reference}
                        {matchedFile && ` (${matchedFile.format}, ${formatBytes(matchedFile.size)})`}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400">No audio verified</p>
                    )}
                    {trackErrors[track.id] && (
                      <p className="text-sm text-red-600">{trackErrors[track.id]}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {folderFiles && folderFiles.length > 0 && (
                        <>
                          <select
                            value={selectedMatch[track.id] ?? ""}
                            onChange={(e) =>
                              setSelectedMatch((prev) => ({ ...prev, [track.id]: e.target.value }))
                            }
                            disabled={status === "saving"}
                            className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-700"
                          >
                            <option value="">Select a file…</option>
                            {folderFiles.map((f) => (
                              <option key={f.relativePath} value={f.relativePath}>
                                {f.relativePath}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!selectedMatch[track.id] || status === "saving"}
                            onClick={() => saveReference(track, selectedMatch[track.id])}
                            className="rounded-md border-0 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Verify
                          </button>
                        </>
                      )}
                      {reference && (
                        <button
                          type="button"
                          disabled={status === "saving"}
                          onClick={() => saveReference(track, null)}
                          className="text-xs text-neutral-500 underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {tracks.map((track) => {
              const status = trackStatus[track.id] ?? "idle";
              const reference = audioRefs[track.id];
              const filenameValue = manualFilename[track.id] ?? reference ?? "";
              const confirmed = manualConfirmed[track.id] ?? false;
              return (
                <li key={track.id} className="space-y-2 py-3">
                  <p className="truncate text-sm text-neutral-900">
                    {track.position}. {track.title}
                  </p>
                  {reference ? (
                    <p className="text-xs text-emerald-700">Self-attested: {reference}</p>
                  ) : (
                    <p className="text-xs text-neutral-400">No audio confirmed</p>
                  )}
                  {trackErrors[track.id] && (
                    <p className="text-sm text-red-600">{trackErrors[track.id]}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filename, e.g. 02 Track Title.wav"
                      value={filenameValue}
                      onChange={(e) =>
                        setManualFilename((prev) => ({ ...prev, [track.id]: e.target.value }))
                      }
                      disabled={status === "saving"}
                      className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-700"
                    />
                    <label className="flex items-center gap-1 text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) =>
                          setManualConfirmed((prev) => ({ ...prev, [track.id]: e.target.checked }))
                        }
                        disabled={status === "saving"}
                      />
                      This file exists on my computer
                    </label>
                    <button
                      type="button"
                      disabled={status === "saving" || !filenameValue.trim() || !confirmed}
                      onClick={() => saveReference(track, filenameValue.trim())}
                      className="rounded-md border-0 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Save
                    </button>
                    {reference && (
                      <button
                        type="button"
                        disabled={status === "saving"}
                        onClick={() => saveReference(track, null)}
                        className="text-xs text-neutral-500 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
