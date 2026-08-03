"use client";

import { useState } from "react";
import type { ExtractedAlbumDraft } from "@/types/catalog";

interface EditableTrack {
  key: string;
  title: string;
  isrc: string;
}

interface EditableDraft {
  title: string;
  artist: string;
  release_date: string;
  upc: string;
  genre: string;
  source_distributor: string;
  tracks: EditableTrack[];
}

function draftFromExtraction(extracted: ExtractedAlbumDraft): EditableDraft {
  const sorted = [...extracted.tracks].sort((a, b) => a.position - b.position);
  return {
    title: extracted.title,
    artist: extracted.artist,
    release_date: extracted.release_date ?? "",
    upc: extracted.upc ?? "",
    genre: extracted.genre ?? "",
    source_distributor: "",
    tracks: sorted.map((t) => ({
      key: crypto.randomUUID(),
      title: t.title,
      isrc: t.isrc ?? "",
    })),
  };
}

/** One release's editable confirm table. Manages its own draft state
 * (initialized once from `initialDraft`) and owns the save call — reused by
 * every import path (screenshot, PDF, CSV/Excel), which all funnel into the
 * same ExtractedAlbumDraft shape and the same /api/import/confirm route.
 * Give this a `key` prop that changes per release (e.g. a queue index) so
 * React remounts it with fresh state instead of trying to reconcile props
 * into stale local edits. */
export default function ConfirmAlbumForm({
  initialDraft,
  progressLabel,
  onConfirmed,
  onSkip,
  onBack,
}: {
  initialDraft: ExtractedAlbumDraft;
  progressLabel?: string;
  onConfirmed: (albumId: string, title: string, artist: string) => void;
  onSkip?: () => void;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState<EditableDraft>(() => draftFromExtraction(initialDraft));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateField<K extends keyof Omit<EditableDraft, "tracks">>(
    field: K,
    value: EditableDraft[K]
  ) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function updateTrack(key: string, field: "title" | "isrc", value: string) {
    setDraft((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => (t.key === key ? { ...t, [field]: value } : t)),
    }));
  }

  function moveTrack(key: string, direction: -1 | 1) {
    setDraft((prev) => {
      const index = prev.tracks.findIndex((t) => t.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.tracks.length) return prev;
      const tracks = [...prev.tracks];
      [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
      return { ...prev, tracks };
    });
  }

  function removeTrack(key: string) {
    setDraft((prev) => ({ ...prev, tracks: prev.tracks.filter((t) => t.key !== key) }));
  }

  function addTrack() {
    setDraft((prev) => ({
      ...prev,
      tracks: [...prev.tracks, { key: crypto.randomUUID(), title: "", isrc: "" }],
    }));
  }

  async function handleConfirm() {
    if (!draft.title.trim() || !draft.artist.trim()) {
      setSaveError("Title and artist are required.");
      return;
    }
    if (draft.tracks.length === 0 || draft.tracks.some((t) => !t.title.trim())) {
      setSaveError("Every track needs a title, and there must be at least one track.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          artist: draft.artist,
          release_date: draft.release_date || null,
          upc: draft.upc || null,
          genre: draft.genre || null,
          source_distributor: draft.source_distributor || null,
          tracks: draft.tracks.map((t) => ({ title: t.title, isrc: t.isrc || null })),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setSaveError(body.error ?? "Save failed.");
        return;
      }

      onConfirmed(body.album_id as string, draft.title, draft.artist);
    } catch {
      setSaveError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {progressLabel && (
        <p className="text-sm font-medium text-neutral-500">{progressLabel}</p>
      )}

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-medium text-neutral-700">Album details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" value={draft.title} onChange={(v) => updateField("title", v)} />
          <Field
            label="Artist"
            value={draft.artist}
            onChange={(v) => updateField("artist", v)}
          />
          <Field
            label="Release date"
            value={draft.release_date}
            onChange={(v) => updateField("release_date", v)}
            placeholder="YYYY-MM-DD"
          />
          <Field label="UPC" value={draft.upc} onChange={(v) => updateField("upc", v)} />
          <Field label="Genre" value={draft.genre} onChange={(v) => updateField("genre", v)} />
          <Field
            label="Source distributor"
            value={draft.source_distributor}
            onChange={(v) => updateField("source_distributor", v)}
            placeholder="e.g. DistroKid"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Tracks</h2>
          <button
            type="button"
            onClick={addTrack}
            className="text-sm font-medium text-neutral-900 underline"
          >
            + Add track
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="w-8 pb-2">#</th>
              <th className="pb-2">Title</th>
              <th className="pb-2">ISRC</th>
              <th className="w-24 pb-2" />
            </tr>
          </thead>
          <tbody>
            {draft.tracks.map((track, index) => (
              <tr key={track.key} className="border-t border-neutral-100">
                <td className="py-2 text-neutral-500">{index + 1}</td>
                <td className="py-2 pr-2">
                  <input
                    value={track.title}
                    onChange={(e) => updateTrack(track.key, "title", e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={track.isrc}
                    onChange={(e) => updateTrack(track.key, "isrc", e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
                  />
                </td>
                <td className="whitespace-nowrap py-2 text-right text-neutral-500">
                  <button
                    type="button"
                    onClick={() => moveTrack(track.key, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${track.title || "track"} up`}
                    className="px-1 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTrack(track.key, 1)}
                    disabled={index === draft.tracks.length - 1}
                    aria-label={`Move ${track.title || "track"} down`}
                    className="px-1 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTrack(track.key)}
                    aria-label={`Remove ${track.title || "track"}`}
                    className="px-1 text-red-600"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <div className="flex gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
          >
            Back
          </button>
        )}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 disabled:opacity-50"
          >
            Skip this release
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Confirm & save"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-700">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
      />
    </label>
  );
}
